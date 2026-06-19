import React from 'react'
import {
  Branch,
  CashTransaction,
  ClosedBill,
  CollectionTransaction,
  CreditTransaction,
  EmployeeBonus,
  EmployeePerformance,
  StockExpiryLot,
  StockItem,
  StockWasteRecord,
  SupplierDebt,
  SupplierPayment,
  TableState
} from '../types'
import { loadBranchReportingData } from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill, roundCurrency } from '../billing'
import { isCriticalStock } from '../criticalStock'
import { getExpiryStatus, getExpiryWarningDays, isExpiryTracked } from '../expiryStock'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'
type BranchFilter = 'all' | string

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type BranchReportRow = {
  branch: Branch
  revenue: number
  profit: number
  orderCount: number
  averageBill: number
  activeTableCount: number
  employeeCount: number
  dailyRevenue: number
  weeklyRevenue: number
  monthlyRevenue: number
  collectionTotal: number
  receivableTotal: number
  debtTotal: number
  cashBalance: number
  stockItemCount: number
  criticalStockCount: number
  expiryRiskCount: number
  wasteCount: number
  averagePerformance: number
  performanceRecordCount: number
  bonusTotal: number
  overtimeMinutes: number
  workedMinutes: number
  financeRisk: boolean
  currentRisk: boolean
  personnelRisk: boolean
  riskScore: number
  efficiencyScore: number
}

type BestBranchCardProps = {
  title: string
  row?: BranchReportRow
  value: (row: BranchReportRow) => React.ReactNode
  detail: (row: BranchReportRow) => React.ReactNode
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

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const isPeriodInRange = (period: string, startDate: string, endDate: string) => {
  const normalizedPeriod = period.slice(0, 7)
  const startPeriod = startDate ? startDate.slice(0, 7) : ''
  const endPeriod = endDate ? endDate.slice(0, 7) : ''

  if(startPeriod && normalizedPeriod < startPeriod) return false
  if(endPeriod && normalizedPeriod > endPeriod) return false
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

  if(mode === 'today') return { startDate: todayKey, endDate: todayKey, label: 'Bugün' }
  if(mode === 'week') return { startDate: getWeekStart(today), endDate: todayKey, label: 'Bu hafta' }
  if(mode === 'month') return { startDate: getMonthStart(today), endDate: todayKey, label: 'Bu ay' }
  if(mode === 'year') return { startDate: getYearStart(today), endDate: todayKey, label: 'Bu yıl' }

  return {
    startDate: customStartDate,
    endDate: customEndDate,
    label: customStartDate || customEndDate ? 'Özel tarih aralığı' : 'Özel tarih'
  }
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatScore = (value: number) => {
  return Math.round(value).toLocaleString('tr-TR')
}

const formatMinutes = (value: number) => {
  const normalizedValue = Math.max(0, Math.round(value))
  if(normalizedValue === 0) return '0 dk'

  const hours = Math.floor(normalizedValue / 60)
  const minutes = normalizedValue % 60

  if(hours === 0) return `${minutes} dk`
  if(minutes === 0) return `${hours} sa`
  return `${hours} sa ${minutes} dk`
}

const getBillDateKey = (bill: ClosedBill) => getLocalDateKey(bill.timestamp)
const getWasteDateKey = (record: StockWasteRecord) => getLocalDateKey(record.occurredAt || record.createdAt)

const countOrderItems = (bills: ClosedBill[], tables: TableState[], includeCurrentTables: boolean) => {
  const closedOrderCount = bills.reduce((sum, bill) => {
    return sum + bill.orders.reduce((orderSum, order) => orderSum + Math.max(0, Number(order.qty) || 0), 0)
  }, 0)

  if(!includeCurrentTables) return closedOrderCount

  return closedOrderCount + tables.reduce((sum, table) => {
    return sum + table.orders.reduce((orderSum, order) => orderSum + Math.max(0, Number(order.qty) || 0), 0)
  }, 0)
}

const sumMoney = (values: number[]) => {
  return roundCurrency(values.reduce((sum, value) => sum + value, 0))
}

const sumAmounts = <T extends { amount: number }>(items: T[]) => {
  return sumMoney(items.map(item => item.amount))
}

const getRevenue = (bills: ClosedBill[]) => sumMoney(bills.map(bill => bill.total))

const getClosedBillPaymentTotal = (bills: ClosedBill[]) => {
  return sumMoney(bills.flatMap(bill => getBillPayments(bill).map(payment => payment.amount)))
}

const getExpiryRiskCount = (lots: StockExpiryLot[], stockItems: StockItem[], today: Date) => {
  const stockItemMap = new Map(stockItems.map(item => [item.id, item]))

  return lots.filter(lot => {
    const item = stockItemMap.get(lot.stockItemId)
    if(!item?.active || !isExpiryTracked(item) || lot.remainingQty <= 0) return false

    const status = getExpiryStatus(lot, getExpiryWarningDays(item), today)
    return status === 'expired' || status === 'near_expiry'
  }).length
}

const getFilteredByBranch = <T extends { branchId: string }>(items: T[], branchId: string) => {
  return items.filter(item => item.branchId === branchId)
}

const getTransactionsInRange = <T extends { date: string }>(items: T[], startDate: string, endDate: string) => {
  return items.filter(item => isDateInRange(item.date, startDate, endDate))
}

const getCashTotal = (transactions: CashTransaction[], type: CashTransaction['type']) => {
  return sumAmounts(transactions.filter(transaction => transaction.type === type))
}

const getTopRow = (rows: BranchReportRow[], getValue: (row: BranchReportRow) => number) => {
  return [...rows].sort((first, second) => {
    const valueDiff = getValue(second) - getValue(first)
    if(valueDiff !== 0) return valueDiff
    return first.branch.name.localeCompare(second.branch.name, 'tr-TR')
  })[0]
}

const getRiskClassName = (row: BranchReportRow) => {
  if(row.riskScore >= 6) return 'danger-pill'
  if(row.riskScore >= 3) return 'warning-pill'
  if(row.riskScore > 0) return 'info-pill'
  return 'success'
}

const getRiskLabel = (row: BranchReportRow) => {
  if(row.riskScore >= 6) return 'Kritik'
  if(row.riskScore >= 3) return 'Yüksek'
  if(row.riskScore > 0) return 'Orta'
  return 'Düşük'
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

function BestBranchCard({ title, row, value, detail }: BestBranchCardProps){
  return (
    <div className="branch-report-best-card">
      <span>{title}</span>
      <strong>{row ? row.branch.name : '-'}</strong>
      <p>{row ? value(row) : '-'}</p>
      <small>{row ? detail(row) : 'Veri yok'}</small>
    </div>
  )
}

export default function BranchReporting(){
  const [reportData] = React.useState(() => loadBranchReportingData())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [branchFilter, setBranchFilter] = React.useState<BranchFilter>('all')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const weekStart = React.useMemo(() => getWeekStart(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])

  const visibleBranches = React.useMemo(() => {
    return reportData.branches
      .filter(branch => branchFilter === 'all' || branch.id === branchFilter)
      .sort((first, second) => {
        if(first.isActive !== second.isActive) return first.isActive ? -1 : 1
        return first.name.localeCompare(second.name, 'tr-TR')
      })
  }, [branchFilter, reportData.branches])

  const rows = React.useMemo<BranchReportRow[]>(() => {
    const revenueBills = reportData.closedBills.filter(isRevenueBill)
    const includeCurrentTables = isDateInRange(todayKey, range.startDate, range.endDate)

    return visibleBranches.map(branch => {
      const branchTables = getFilteredByBranch(reportData.tables, branch.id)
      const branchStockItems = getFilteredByBranch(reportData.stockItems, branch.id)
      const branchExpiryLots = getFilteredByBranch(reportData.stockExpiryLots, branch.id)
      const branchWasteRecords = getFilteredByBranch(reportData.stockWasteRecords, branch.id)
      const branchCredits = getFilteredByBranch(reportData.creditTransactions, branch.id)
      const branchCollections = getFilteredByBranch(reportData.collectionTransactions, branch.id)
      const branchSupplierDebts = getFilteredByBranch(reportData.supplierDebts, branch.id)
      const branchSupplierPayments = getFilteredByBranch(reportData.supplierPayments, branch.id)
      const branchCashTransactions = getFilteredByBranch(reportData.cashTransactions, branch.id)
      const branchEmployees = getFilteredByBranch(reportData.employees, branch.id)
      const branchAttendances = getFilteredByBranch(reportData.attendances, branch.id)
      const branchPerformances = getFilteredByBranch(reportData.employeePerformances, branch.id)
      const branchBonuses = getFilteredByBranch(reportData.employeeBonuses, branch.id)

      const branchRevenueBills = revenueBills.filter(bill => bill.branchId === branch.id)
      const rangeBills = branchRevenueBills.filter(bill => isDateInRange(getBillDateKey(bill), range.startDate, range.endDate))
      const todayBills = branchRevenueBills.filter(bill => getBillDateKey(bill) === todayKey)
      const weekBills = branchRevenueBills.filter(bill => isDateInRange(getBillDateKey(bill), weekStart, todayKey))
      const monthBills = branchRevenueBills.filter(bill => isDateInRange(getBillDateKey(bill), monthStart, todayKey))
      const rangeCredits = getTransactionsInRange(branchCredits, range.startDate, range.endDate)
      const rangeCollections = getTransactionsInRange(branchCollections, range.startDate, range.endDate)
      const rangeSupplierDebts = getTransactionsInRange(branchSupplierDebts, range.startDate, range.endDate)
      const rangeSupplierPayments = getTransactionsInRange(branchSupplierPayments, range.startDate, range.endDate)
      const rangeCashTransactions = getTransactionsInRange(branchCashTransactions, range.startDate, range.endDate)
      const rangeAttendances = branchAttendances.filter(attendance => isDateInRange(attendance.workDate, range.startDate, range.endDate))
      const rangePerformances = branchPerformances.filter(performance => isDateInRange(performance.workDate, range.startDate, range.endDate))
      const rangeBonuses = branchBonuses.filter(bonus => bonus.status !== 'İptal' && isPeriodInRange(bonus.period, range.startDate, range.endDate))
      const rangeWasteRecords = branchWasteRecords.filter(record => isDateInRange(getWasteDateKey(record), range.startDate, range.endDate) && record.status !== 'reversed')
      const activeTables = branchTables.filter(table => table.open)
      const revenue = getRevenue(rangeBills)
      const cashIncome = getCashTotal(rangeCashTransactions, 'Gelir')
      const cashExpense = getCashTotal(rangeCashTransactions, 'Gider')
      const supplierPaymentTotal = sumAmounts(rangeSupplierPayments)
      const collectionTotal = sumAmounts(rangeCollections)
      const receivableTotal = roundCurrency(rangeCredits
        .filter(transaction => transaction.status === 'Açık')
        .reduce((sum, transaction) => sum + transaction.remainingAmount, 0))
      const debtTotal = roundCurrency(rangeSupplierDebts
        .filter(debt => debt.status === 'Açık')
        .reduce((sum, debt) => sum + debt.remainingAmount, 0))
      const cashBalance = roundCurrency(getClosedBillPaymentTotal(rangeBills) + collectionTotal + cashIncome - supplierPaymentTotal - cashExpense)
      const performanceTotal = rangePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
      const averagePerformance = rangePerformances.length > 0 ? Math.round(performanceTotal / rangePerformances.length) : 0
      const workedMinutes = rangeAttendances.reduce((sum, attendance) => sum + attendance.workedMinutes, 0)
      const overtimeMinutes = rangeAttendances.reduce((sum, attendance) => sum + attendance.overtimeMinutes, 0)
      const employeeCount = branchEmployees.filter(employee => employee.isActive).length
      const financeRisk = cashBalance < 0 || revenue + cashIncome - cashExpense - supplierPaymentTotal < 0 || debtTotal > Math.max(receivableTotal, revenue)
      const currentRisk = receivableTotal >= 10000 || rangeCredits.filter(transaction => transaction.status === 'Açık').length >= 3
      const personnelRisk = employeeCount === 0 || rangeAttendances.some(attendance => attendance.status === 'Devamsız') || (rangePerformances.length > 0 && averagePerformance < 50)
      const criticalStockCount = branchStockItems.filter(isCriticalStock).length
      const expiryRiskCount = getExpiryRiskCount(branchExpiryLots, branchStockItems, today)
      const riskScore = criticalStockCount * 2
        + expiryRiskCount
        + (financeRisk ? 3 : 0)
        + (currentRisk ? 2 : 0)
        + (personnelRisk ? 2 : 0)
      const profit = roundCurrency(revenue + cashIncome - cashExpense - supplierPaymentTotal)
      const workedHours = workedMinutes / 60
      const efficiencyScore = workedHours > 0 ? revenue / workedHours : averagePerformance

      return {
        branch,
        revenue,
        profit,
        orderCount: countOrderItems(rangeBills, activeTables, includeCurrentTables),
        averageBill: rangeBills.length > 0 ? roundCurrency(revenue / rangeBills.length) : 0,
        activeTableCount: activeTables.length,
        employeeCount,
        dailyRevenue: getRevenue(todayBills),
        weeklyRevenue: getRevenue(weekBills),
        monthlyRevenue: getRevenue(monthBills),
        collectionTotal,
        receivableTotal,
        debtTotal,
        cashBalance,
        stockItemCount: branchStockItems.filter(item => item.active).length,
        criticalStockCount,
        expiryRiskCount,
        wasteCount: rangeWasteRecords.length,
        averagePerformance,
        performanceRecordCount: rangePerformances.length,
        bonusTotal: sumMoney(rangeBonuses.map(bonus => bonus.bonusAmount)),
        overtimeMinutes,
        workedMinutes,
        financeRisk,
        currentRisk,
        personnelRisk,
        riskScore,
        efficiencyScore
      }
    })
  }, [monthStart, range.endDate, range.startDate, reportData, today, todayKey, visibleBranches, weekStart])

  const highestRevenueRow = getTopRow(rows, row => row.revenue)
  const highestProfitRow = getTopRow(rows, row => row.profit)
  const highestPerformanceRow = getTopRow(rows, row => row.averagePerformance)
  const highestEfficiencyRow = getTopRow(rows, row => row.efficiencyScore)
  const bestRows = [highestRevenueRow, highestProfitRow, highestEfficiencyRow, highestPerformanceRow]

  const mainKpis = [
    {
      label: 'Toplam Şube',
      value: formatNumber(rows.length),
      detail: `${rows.filter(row => row.branch.isActive).length} aktif şube`
    },
    {
      label: 'En Yüksek Ciro',
      value: highestRevenueRow ? formatCurrency(highestRevenueRow.revenue) : formatCurrency(0),
      detail: highestRevenueRow?.branch.name || '-'
    },
    {
      label: 'En Yüksek Kâr',
      value: highestProfitRow ? formatCurrency(highestProfitRow.profit) : formatCurrency(0),
      detail: highestProfitRow?.branch.name || '-'
    },
    {
      label: 'En Yüksek Performans',
      value: highestPerformanceRow ? formatScore(highestPerformanceRow.averagePerformance) : '0',
      detail: highestPerformanceRow?.branch.name || '-'
    }
  ]

  return (
    <div className="branch-reporting-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Şubeler Arası Raporlama</h2>
          <p className="muted">Şubelerin performanslarını karşılaştırmalı olarak inceleyin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">{range.label}</span>
          <span className="dashboard-date-pill">{range.startDate || 'Başlangıç'} - {range.endDate || 'Bitiş'}</span>
        </div>
      </div>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Seçim değişince tüm karşılaştırmalar yeniden hesaplanır.</p>
          </div>
          <div className="toolbar-controls branch-reporting-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} disabled={rangeMode !== 'custom'} />
            <input type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} disabled={rangeMode !== 'custom'} />
            <select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}>
              <option value="all">Tüm Şubeler</option>
              {reportData.branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        {mainKpis.map(kpi => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} detail={kpi.detail} />
        ))}
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Şube Performans Tablosu</h3>
            <p className="muted">{rows.length} şube karşılaştırılıyor.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table branch-reporting-table">
            <thead>
              <tr>
                <th>Şube</th>
                <th>Toplam Ciro</th>
                <th>Sipariş Sayısı</th>
                <th>Ortalama Adisyon</th>
                <th>Aktif Masa</th>
                <th>Personel Sayısı</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">Filtreye uygun şube bulunamadı.</td></tr>
              )}
              {rows.map(row => (
                <tr key={row.branch.id}>
                  <td>
                    <strong>{row.branch.name}</strong>
                    <p className="muted small-text">{row.branch.city || '-'} · {row.branch.code}</p>
                  </td>
                  <td>{formatCurrency(row.revenue)}</td>
                  <td>{formatNumber(row.orderCount)}</td>
                  <td>{formatCurrency(row.averageBill)}</td>
                  <td>{formatNumber(row.activeTableCount)}</td>
                  <td>{formatNumber(row.employeeCount)}</td>
                  <td><span className={`status-pill ${row.branch.isActive ? 'success' : 'muted-pill'}`}>{row.branch.isActive ? 'Aktif' : 'Pasif'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="branch-reporting-grid">
        <section className="card">
          <div className="section-header compact">
            <h3>Satış Karşılaştırması</h3>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table branch-reporting-mini-table">
              <thead>
                <tr>
                  <th>Şube</th>
                  <th>Günlük Ciro</th>
                  <th>Haftalık Ciro</th>
                  <th>Aylık Ciro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.branch.id}>
                    <td>{row.branch.name}</td>
                    <td>{formatCurrency(row.dailyRevenue)}</td>
                    <td>{formatCurrency(row.weeklyRevenue)}</td>
                    <td>{formatCurrency(row.monthlyRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Finans Karşılaştırması</h3>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table branch-reporting-mini-table">
              <thead>
                <tr>
                  <th>Şube</th>
                  <th>Tahsilat</th>
                  <th>Alacak</th>
                  <th>Borç</th>
                  <th>Kasa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.branch.id}>
                    <td>{row.branch.name}</td>
                    <td>{formatCurrency(row.collectionTotal)}</td>
                    <td>{formatCurrency(row.receivableTotal)}</td>
                    <td>{formatCurrency(row.debtTotal)}</td>
                    <td>{formatCurrency(row.cashBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Stok Karşılaştırması</h3>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table branch-reporting-mini-table">
              <thead>
                <tr>
                  <th>Şube</th>
                  <th>Stok Kalemi</th>
                  <th>Kritik Stok</th>
                  <th>SKT Riski</th>
                  <th>Fire Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.branch.id}>
                    <td>{row.branch.name}</td>
                    <td>{formatNumber(row.stockItemCount)}</td>
                    <td>{formatNumber(row.criticalStockCount)}</td>
                    <td>{formatNumber(row.expiryRiskCount)}</td>
                    <td>{formatNumber(row.wasteCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <h3>Personel Karşılaştırması</h3>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table branch-reporting-mini-table">
              <thead>
                <tr>
                  <th>Şube</th>
                  <th>Personel</th>
                  <th>Ort. Performans</th>
                  <th>Toplam Prim</th>
                  <th>Toplam Mesai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.branch.id}>
                    <td>{row.branch.name}</td>
                    <td>{formatNumber(row.employeeCount)}</td>
                    <td>{formatScore(row.averagePerformance)}</td>
                    <td>{formatCurrency(row.bonusTotal)}</td>
                    <td>{formatMinutes(row.overtimeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>En İyi Şubeler</h3>
            <p className="muted">Ciro, kârlılık, verimlilik ve personel performansı liderleri.</p>
          </div>
        </div>
        <div className="branch-report-best-grid">
          <BestBranchCard
            title="En Yüksek Ciro"
            row={bestRows[0]}
            value={row => formatCurrency(row.revenue)}
            detail={row => `${formatNumber(row.orderCount)} sipariş`}
          />
          <BestBranchCard
            title="En Yüksek Kârlılık"
            row={bestRows[1]}
            value={row => formatCurrency(row.profit)}
            detail={row => `Kasa durumu ${formatCurrency(row.cashBalance)}`}
          />
          <BestBranchCard
            title="En Verimli Şube"
            row={bestRows[2]}
            value={row => row.workedMinutes > 0 ? `${formatCurrency(row.efficiencyScore)} / saat` : formatScore(row.efficiencyScore)}
            detail={row => `${formatMinutes(row.workedMinutes)} çalışma`}
          />
          <BestBranchCard
            title="En Başarılı Personel Ortalaması"
            row={bestRows[3]}
            value={row => formatScore(row.averagePerformance)}
            detail={row => `${formatNumber(row.performanceRecordCount)} performans kaydı`}
          />
        </div>
      </section>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Risk Analizi</h3>
            <p className="muted">Kritik stok, finans, cari ve personel riskleri şube bazında izlenir.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table branch-reporting-risk-table">
            <thead>
              <tr>
                <th>Şube</th>
                <th>Kritik Stok</th>
                <th>Finans Riski</th>
                <th>Cari Riski</th>
                <th>Personel Riski</th>
                <th>Risk Skoru</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.branch.id}>
                  <td>{row.branch.name}</td>
                  <td>{formatNumber(row.criticalStockCount)}</td>
                  <td><span className={`status-pill ${row.financeRisk ? 'warning-pill' : 'success'}`}>{row.financeRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${row.currentRisk ? 'warning-pill' : 'success'}`}>{row.currentRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${row.personnelRisk ? 'warning-pill' : 'success'}`}>{row.personnelRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${getRiskClassName(row)}`}>{getRiskLabel(row)} · {formatNumber(row.riskScore)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
