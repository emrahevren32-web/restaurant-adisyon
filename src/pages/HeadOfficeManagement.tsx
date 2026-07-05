import React from 'react'
import {
  Branch,
  BranchStockTransfer,
  CashClosing,
  CashTransaction,
  ClosedBill,
  CreditTransaction,
  EmployeeAudit,
  EmployeeBonus,
  EmployeePerformance,
  StockExpiryLot,
  StockItem
} from '../types'
import { loadBranchReportingData } from '../storage'
import { formatCurrency, isRevenueBill, roundCurrency } from '../billing'
import { isCriticalStock } from '../criticalStock'
import { getExpiryStatus, getExpiryWarningDays, isExpiryTracked } from '../expiryStock'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'
type RiskLevel = 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik'

type BranchOfficeRow = {
  branch: Branch
  dailyRevenue: number
  monthlyRevenue: number
  rangeRevenue: number
  profit: number
  employeeCount: number
  activeTableCount: number
  stockItemCount: number
  currentAccountCount: number
  criticalStockCount: number
  expiryRiskCount: number
  criticalCurrentCount: number
  criticalAuditCount: number
  pendingTransferCount: number
  averagePerformance: number
  financeRisk: boolean
  stockRisk: boolean
  currentRisk: boolean
  personnelRisk: boolean
  riskScore: number
  riskLevel: RiskLevel
}

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
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
const formatScore = (value: number) => Math.round(value).toLocaleString('tr-TR')
const sumMoney = (values: number[]) => roundCurrency(values.reduce((sum, value) => sum + value, 0))
const getBillDateKey = (bill: ClosedBill) => getLocalDateKey(bill.timestamp)
const getAuditDateKey = (audit: EmployeeAudit) => getLocalDateKey(audit.date)
const getTransferDateKey = (transfer: BranchStockTransfer) => getLocalDateKey(transfer.transferDate)

const getTransactionsInRange = <T extends { date: string }>(items: T[], startDate: string, endDate: string) => {
  return items.filter(item => isDateInRange(item.date, startDate, endDate))
}

const getBranchItems = <T extends { branchId: string }>(items: T[], branchId: string) => {
  return items.filter(item => item.branchId === branchId)
}

const getCashTotal = (transactions: CashTransaction[], type: CashTransaction['type']) => {
  return sumMoney(transactions.filter(transaction => transaction.type === type).map(transaction => transaction.amount))
}

const getRevenue = (bills: ClosedBill[]) => {
  return sumMoney(bills.map(bill => bill.total))
}

const getLatestCashClosing = (closings: CashClosing[]) => {
  return [...closings].sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return second.createdAt.localeCompare(first.createdAt)
  })[0]
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

const getCriticalCurrentCount = (transactions: CreditTransaction[]) => {
  return transactions.filter(transaction => transaction.status === 'Açık' && transaction.remainingAmount >= 5000).length
}

const getRiskLevel = (score: number): RiskLevel => {
  if(score >= 15) return 'Kritik'
  if(score >= 9) return 'Yüksek'
  if(score >= 4) return 'Orta'
  return 'Düşük'
}

const getRiskClassName = (level: RiskLevel) => {
  if(level === 'Kritik') return 'danger-pill'
  if(level === 'Yüksek') return 'warning-pill'
  if(level === 'Orta') return 'info-pill'
  return 'success'
}

const getTopRow = (rows: BranchOfficeRow[], getValue: (row: BranchOfficeRow) => number) => {
  return [...rows].sort((first, second) => {
    const valueDiff = getValue(second) - getValue(first)
    if(valueDiff !== 0) return valueDiff
    return first.branch.name.localeCompare(second.branch.name, 'tr-TR')
  })[0]
}

const getLowestRiskRow = (rows: BranchOfficeRow[]) => {
  return [...rows].sort((first, second) => {
    const riskDiff = first.riskScore - second.riskScore
    if(riskDiff !== 0) return riskDiff
    return first.branch.name.localeCompare(second.branch.name, 'tr-TR')
  })[0]
}

function KpiCard({ label, value, detail }: KpiCardProps){
  return (
    <div className="metric-card dashboard-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function LeaderCard({
  title,
  row,
  value,
  detail
}: {
  title: string
  row?: BranchOfficeRow
  value: (row: BranchOfficeRow) => React.ReactNode
  detail: (row: BranchOfficeRow) => React.ReactNode
}){
  return (
    <div className="branch-report-best-card">
      <span>{title}</span>
      <strong>{row ? row.branch.name : '-'}</strong>
      <p>{row ? value(row) : '-'}</p>
      <small>{row ? detail(row) : 'Veri yok'}</small>
    </div>
  )
}

export default function HeadOfficeManagement(){
  const [reportData] = React.useState(() => loadBranchReportingData())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])

  const revenueBills = React.useMemo(() => reportData.closedBills.filter(isRevenueBill), [reportData.closedBills])

  const rows = React.useMemo<BranchOfficeRow[]>(() => {
    return reportData.branches.map(branch => {
      const branchTables = getBranchItems(reportData.tables, branch.id)
      const branchRevenueBills = revenueBills.filter(bill => bill.branchId === branch.id)
      const rangeBills = branchRevenueBills.filter(bill => isDateInRange(getBillDateKey(bill), range.startDate, range.endDate))
      const todayBills = branchRevenueBills.filter(bill => getBillDateKey(bill) === todayKey)
      const monthBills = branchRevenueBills.filter(bill => isDateInRange(getBillDateKey(bill), monthStart, todayKey))
      const branchCashTransactions = getBranchItems(reportData.cashTransactions, branch.id)
      const branchCashClosings = getBranchItems(reportData.cashClosings, branch.id)
      const rangeCashTransactions = getTransactionsInRange(branchCashTransactions, range.startDate, range.endDate)
      const rangeCashClosings = getTransactionsInRange(branchCashClosings, range.startDate, range.endDate)
      const branchEmployees = getBranchItems(reportData.employees, branch.id)
      const branchStockItems = getBranchItems(reportData.stockItems, branch.id)
      const branchExpiryLots = getBranchItems(reportData.stockExpiryLots, branch.id)
      const branchCurrentAccounts = getBranchItems(reportData.currentAccounts, branch.id)
      const branchCredits = getBranchItems(reportData.creditTransactions, branch.id)
      const rangeCredits = getTransactionsInRange(branchCredits, range.startDate, range.endDate)
      const rangePerformances = getBranchItems(reportData.employeePerformances, branch.id)
        .filter(performance => isDateInRange(performance.workDate, range.startDate, range.endDate))
      const rangeAttendances = getBranchItems(reportData.attendances, branch.id)
        .filter(attendance => isDateInRange(attendance.workDate, range.startDate, range.endDate))
      const rangeAudits = getBranchItems(reportData.employeeAudits, branch.id)
        .filter(audit => isDateInRange(getAuditDateKey(audit), range.startDate, range.endDate))
      const rangeTransfers = reportData.branchStockTransfers.filter(transfer => (
        (transfer.sourceBranchId === branch.id || transfer.targetBranchId === branch.id)
        && isDateInRange(getTransferDateKey(transfer), range.startDate, range.endDate)
      ))
      const revenue = getRevenue(rangeBills)
      const cashIncome = getCashTotal(rangeCashTransactions, 'Gelir')
      const cashExpense = getCashTotal(rangeCashTransactions, 'Gider')
      const netCash = roundCurrency(revenue + cashIncome - cashExpense)
      const latestCashClosing = getLatestCashClosing(rangeCashClosings)
      const averagePerformance = rangePerformances.length > 0
        ? Math.round(rangePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0) / rangePerformances.length)
        : 0
      const activeEmployees = branchEmployees.filter(employee => employee.isActive).length
      const criticalStockCount = branchStockItems.filter(isCriticalStock).length
      const expiryRiskCount = getExpiryRiskCount(branchExpiryLots, branchStockItems, today)
      const criticalCurrentCount = getCriticalCurrentCount(rangeCredits)
      const criticalAuditCount = rangeAudits.filter(audit => audit.severity === 'Kritik').length
      const pendingTransferCount = rangeTransfers.filter(transfer => transfer.status === 'Bekliyor').length
      const absenceCount = rangeAttendances.filter(attendance => attendance.status === 'Devamsız').length
      const financeRisk = netCash < 0 || Boolean(latestCashClosing && (latestCashClosing.actualBalance < 0 || latestCashClosing.difference < 0))
      const stockRisk = criticalStockCount + expiryRiskCount > 0
      const currentRisk = criticalCurrentCount > 0
      const personnelRisk = criticalAuditCount > 0 || absenceCount > 0 || (rangePerformances.length > 0 && averagePerformance < 50)
      const riskScore = (financeRisk ? 3 : 0)
        + criticalStockCount * 3
        + expiryRiskCount * 2
        + criticalCurrentCount * 2
        + criticalAuditCount * 4
        + pendingTransferCount
        + (personnelRisk ? 2 : 0)
        + (branch.isActive ? 0 : 5)

      return {
        branch,
        dailyRevenue: getRevenue(todayBills),
        monthlyRevenue: getRevenue(monthBills),
        rangeRevenue: revenue,
        profit: netCash,
        employeeCount: activeEmployees,
        activeTableCount: branchTables.filter(table => table.open).length,
        stockItemCount: branchStockItems.filter(item => item.active).length,
        currentAccountCount: branchCurrentAccounts.filter(account => account.isActive).length,
        criticalStockCount,
        expiryRiskCount,
        criticalCurrentCount,
        criticalAuditCount,
        pendingTransferCount,
        averagePerformance,
        financeRisk,
        stockRisk,
        currentRisk,
        personnelRisk,
        riskScore,
        riskLevel: getRiskLevel(riskScore)
      }
    }).sort((first, second) => {
      if(first.branch.isActive !== second.branch.isActive) return first.branch.isActive ? -1 : 1
      return first.branch.name.localeCompare(second.branch.name, 'tr-TR')
    })
  }, [monthStart, range.endDate, range.startDate, reportData, revenueBills, today, todayKey])

  const rangeTransfers = React.useMemo(() => {
    return reportData.branchStockTransfers.filter(transfer => isDateInRange(getTransferDateKey(transfer), range.startDate, range.endDate))
  }, [range.endDate, range.startDate, reportData.branchStockTransfers])
  const rangeBonuses = React.useMemo(() => {
    return reportData.employeeBonuses.filter((bonus: EmployeeBonus) => bonus.status !== 'İptal' && isPeriodInRange(bonus.period, range.startDate, range.endDate))
  }, [range.endDate, range.startDate, reportData.employeeBonuses])
  const rangePerformances = React.useMemo(() => {
    return reportData.employeePerformances.filter((performance: EmployeePerformance) => isDateInRange(performance.workDate, range.startDate, range.endDate))
  }, [range.endDate, range.startDate, reportData.employeePerformances])
  const criticalStockTotal = rows.reduce((sum, row) => sum + row.criticalStockCount, 0)
  const criticalCurrentTotal = rows.reduce((sum, row) => sum + row.criticalCurrentCount, 0)
  const criticalAuditTotal = rows.reduce((sum, row) => sum + row.criticalAuditCount, 0)
  const pendingTransferTotal = rangeTransfers.filter(transfer => transfer.status === 'Bekliyor').length
  const passiveBranchTotal = reportData.branches.filter(branch => !branch.isActive).length
  const permissionRecordCount = reportData.branchPermissions.length
  const riskRecordTotal = criticalStockTotal + criticalCurrentTotal + criticalAuditTotal + pendingTransferTotal + passiveBranchTotal
  const totalRevenue = rows.reduce((sum, row) => sum + row.rangeRevenue, 0)
  const totalStaff = rows.reduce((sum, row) => sum + row.employeeCount, 0)
  const totalActiveTables = rows.reduce((sum, row) => sum + row.activeTableCount, 0)
  const totalStockItems = rows.reduce((sum, row) => sum + row.stockItemCount, 0)
  const totalCurrentAccounts = rows.reduce((sum, row) => sum + row.currentAccountCount, 0)
  const averagePerformance = rangePerformances.length > 0
    ? Math.round(rangePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0) / rangePerformances.length)
    : 0
  const bonusTotal = sumMoney(rangeBonuses.map(bonus => bonus.bonusAmount))
  const highestRevenueRow = getTopRow(rows, row => row.rangeRevenue)
  const highestProfitRow = getTopRow(rows, row => row.profit)
  const highestPerformanceRow = getTopRow(rows, row => row.averagePerformance)
  const lowestRiskRow = getLowestRiskRow(rows)
  const generalRiskScore = rows.reduce((sum, row) => sum + row.riskScore, 0)

  const warningItems = [
    { label: 'Kritik Stoklar', value: criticalStockTotal, detail: 'Minimum seviye altında' },
    { label: 'Kritik Cari Hesaplar', value: criticalCurrentTotal, detail: 'Açık borç riski' },
    { label: 'Kritik Disiplin Kayıtları', value: criticalAuditTotal, detail: 'Kritik önem seviyesi' },
    { label: 'Bekleyen Transferler', value: pendingTransferTotal, detail: 'Onay bekleyen kayıt' },
    { label: 'Pasif Şubeler', value: passiveBranchTotal, detail: 'Aktif olmayan şube' },
    { label: 'Yetki Kontrolü', value: permissionRecordCount, detail: 'Kayıtlı yetki' }
  ]
  const transferSummary = [
    { label: 'Bekleyen Transferler', value: rangeTransfers.filter(transfer => transfer.status === 'Bekliyor').length, className: 'warning-pill' },
    { label: 'Onaylanan Transferler', value: rangeTransfers.filter(transfer => transfer.status === 'Onaylandı').length, className: 'info-pill' },
    { label: 'Tamamlanan Transferler', value: rangeTransfers.filter(transfer => transfer.status === 'Tamamlandı').length, className: 'success' },
    { label: 'İptal Edilen Transferler', value: rangeTransfers.filter(transfer => transfer.status === 'İptal Edildi').length, className: 'muted-pill' }
  ]

  return (
    <div className="head-office-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Merkez Ofis Yönetimi</h2>
          <p className="muted">Tüm şubeleri merkezi olarak yönetin.</p>
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
            <p className="muted">Tarih aralığı değişince tüm merkez özetleri yeniden hesaplanır.</p>
          </div>
          <div className="toolbar-controls head-office-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="custom">Özel Tarih Aralığı</option>
            </select>
            <input type="date" value={customStartDate} onChange={event => setCustomStartDate(event.target.value)} disabled={rangeMode !== 'custom'} />
            <input type="date" value={customEndDate} onChange={event => setCustomEndDate(event.target.value)} disabled={rangeMode !== 'custom'} />
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Şube" value={formatNumber(reportData.branches.length)} detail={`${reportData.branches.filter(branch => branch.isActive).length} aktif şube`} />
        <KpiCard label="Toplam Gelir" value={formatCurrency(totalRevenue)} detail={range.label} />
        <KpiCard label="Toplam Personel" value={formatNumber(totalStaff)} detail="Aktif personel" />
        <KpiCard label="Toplam Aktif Alan" value={formatNumber(totalActiveTables)} detail="Açık alan" />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid">
        <KpiCard label="Toplam Stok Kalemi" value={formatNumber(totalStockItems)} detail="Aktif stok kartı" />
        <KpiCard label="Toplam Cari" value={formatNumber(totalCurrentAccounts)} detail="Aktif cari" />
        <KpiCard label="Toplam Transfer" value={formatNumber(rangeTransfers.length)} detail={range.label} />
        <KpiCard label="Toplam Risk Kaydı" value={formatNumber(riskRecordTotal)} detail={`Genel skor ${formatNumber(generalRiskScore)}`} />
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Şube Özeti</h3>
            <p className="muted">{rows.length} şube merkezi görünümde listeleniyor.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table head-office-branch-table">
            <thead>
              <tr>
                <th>Şube Adı</th>
                <th>Günlük Gelir</th>
                <th>Aylık Gelir</th>
                <th>Personel Sayısı</th>
                <th>Aktif Alan</th>
                <th>Risk Durumu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.branch.id}>
                  <td>
                    <strong>{row.branch.name}</strong>
                    <p className="muted small-text">{row.branch.city || '-'} · {row.branch.code}</p>
                  </td>
                  <td>{formatCurrency(row.dailyRevenue)}</td>
                  <td>{formatCurrency(row.monthlyRevenue)}</td>
                  <td>{formatNumber(row.employeeCount)}</td>
                  <td>{formatNumber(row.activeTableCount)}</td>
                  <td><span className={`status-pill ${getRiskClassName(row.riskLevel)}`}>{row.riskLevel} · {formatNumber(row.riskScore)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="head-office-grid">
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Merkez Uyarıları</h3>
              <p className="muted">Müdahale gerektiren merkezi başlıklar.</p>
            </div>
          </div>
          <div className="head-office-warning-list">
            {warningItems.map(item => (
              <div key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <span className={`status-pill ${item.value > 0 ? 'warning-pill' : 'success'}`}>{formatNumber(item.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Transfer Merkezi</h3>
              <p className="muted">Şubeler arası hareketlerin durum özeti.</p>
            </div>
          </div>
          <div className="head-office-transfer-grid">
            {transferSummary.map(item => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{formatNumber(item.value)}</strong>
                <em className={`status-pill ${item.className}`}>{range.label}</em>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Performans Liderleri</h3>
            <p className="muted">Gelir, kârlılık, performans ve risk liderleri.</p>
          </div>
        </div>
        <div className="branch-report-best-grid">
          <LeaderCard title="En Yüksek Gelir Üreten Şube" row={highestRevenueRow} value={row => formatCurrency(row.rangeRevenue)} detail={row => `${formatCurrency(row.dailyRevenue)} günlük gelir`} />
          <LeaderCard title="En Yüksek Kârlı Şube" row={highestProfitRow} value={row => formatCurrency(row.profit)} detail={row => `Prim toplamı ${formatCurrency(bonusTotal)}`} />
          <LeaderCard title="En Yüksek Performanslı Şube" row={highestPerformanceRow} value={row => formatScore(row.averagePerformance)} detail={() => `Genel ortalama ${formatScore(averagePerformance)}`} />
          <LeaderCard title="En Düşük Riskli Şube" row={lowestRiskRow} value={row => `${row.riskLevel} · ${formatNumber(row.riskScore)}`} detail={row => `${formatNumber(row.criticalStockCount)} kritik stok`} />
        </div>
      </section>

      <section className="card">
        <div className="section-header compact">
          <div>
            <h3>Risk Merkezi</h3>
            <p className="muted">Finans, stok, cari ve personel riskleri şube bazında izlenir.</p>
          </div>
          <span className={`status-pill ${getRiskClassName(getRiskLevel(generalRiskScore))}`}>Genel Risk Skoru {formatNumber(generalRiskScore)}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table head-office-risk-table">
            <thead>
              <tr>
                <th>Şube</th>
                <th>Finans Riski</th>
                <th>Stok Riski</th>
                <th>Cari Riski</th>
                <th>Personel Riski</th>
                <th>Risk Skoru</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.branch.id}>
                  <td>{row.branch.name}</td>
                  <td><span className={`status-pill ${row.financeRisk ? 'warning-pill' : 'success'}`}>{row.financeRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${row.stockRisk ? 'warning-pill' : 'success'}`}>{row.stockRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${row.currentRisk ? 'warning-pill' : 'success'}`}>{row.currentRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${row.personnelRisk ? 'warning-pill' : 'success'}`}>{row.personnelRisk ? 'Var' : 'Yok'}</span></td>
                  <td><span className={`status-pill ${getRiskClassName(row.riskLevel)}`}>{row.riskLevel} · {formatNumber(row.riskScore)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
