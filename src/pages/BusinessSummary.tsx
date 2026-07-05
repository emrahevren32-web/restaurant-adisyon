import React from 'react'
import {
  Attendance,
  CashClosing,
  CashTransaction,
  ClosedBill,
  CollectionTransaction,
  CreditTransaction,
  CurrentAccount,
  Employee,
  EmployeeAudit,
  EmployeeBonus,
  EmployeePerformance,
  KitchenOrder,
  Order,
  Product,
  StockExpiryLot,
  StockItem,
  SupplierDebt,
  SupplierPayment,
  TableState
} from '../types'
import {
  loadAttendances,
  loadCashClosings,
  loadCashTransactions,
  loadClosed,
  loadCollectionTransactions,
  loadCreditTransactions,
  loadCurrentAccounts,
  loadEmployeeAudits,
  loadEmployeeBonuses,
  loadEmployeePerformances,
  loadEmployees,
  loadKitchenOrders,
  loadProducts,
  loadStockExpiryLots,
  loadStockItems,
  loadSupplierDebts,
  loadSupplierPayments,
  loadTables
} from '../storage'
import { formatCurrency, getBillPayments, isRevenueBill, roundCurrency } from '../billing'
import { isCriticalStock } from '../criticalStock'
import { getExpiryStatus, getExpiryWarningDays, isExpiryTracked } from '../expiryStock'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type SummaryItem = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}

type SummaryPanelProps = {
  title: string
  description: string
  badge: React.ReactNode
  items: SummaryItem[]
}

type DebtorRow = {
  account: CurrentAccount
  netBalance: number
  lastCollectionDate: string
  daysSinceLastCollection?: number
}

const HIGH_RISK_BALANCE = 10000
const MEDIUM_RISK_BALANCE = 5000
const HIGH_RISK_DAYS = 60
const MEDIUM_RISK_DAYS = 30

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

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const getDaysSince = (dateKey: string, todayKey: string) => {
  if(!dateKey) return undefined

  const date = new Date(dateKey)
  const today = new Date(todayKey)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return undefined

  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

const getLastDate = (dates: string[]) => {
  return dates.reduce((latest, date) => {
    if(!latest) return date
    return date > latest ? date : latest
  }, '')
}

const sumMoney = (values: number[]) => roundCurrency(values.reduce((sum, value) => sum + value, 0))

const sumAmounts = <T extends { amount: number }>(items: T[]) => {
  return sumMoney(items.map(item => item.amount))
}

const countOrderItems = (orders: Order[]) => {
  return orders.reduce((sum, order) => sum + Math.max(0, Number(order.qty) || 0), 0)
}

const countKitchenItems = (orders: KitchenOrder[]) => {
  return orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + Math.max(0, Number(item.qty) || 0), 0)
  }, 0)
}

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR')
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

const getLatestClosingBalance = (closings: CashClosing[]) => {
  const latestClosing = [...closings].sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })[0]

  return latestClosing?.actualBalance
}

const buildDebtorRows = ({
  accounts,
  credits,
  collections,
  todayKey
}: {
  accounts: CurrentAccount[]
  credits: CreditTransaction[]
  collections: CollectionTransaction[]
  todayKey: string
}): DebtorRow[] => {
  return accounts.map(account => {
    const accountCredits = credits.filter(transaction => transaction.currentAccountId === account.id)
    const accountCollections = collections.filter(transaction => transaction.currentAccountId === account.id)
    const totalDebt = sumAmounts(accountCredits)
    const totalCollection = sumAmounts(accountCollections)
    const netBalance = roundCurrency(Math.max(0, totalDebt - totalCollection))
    const lastCollectionDate = getLastDate(accountCollections.map(transaction => transaction.date))

    return {
      account,
      netBalance,
      lastCollectionDate,
      daysSinceLastCollection: getDaysSince(lastCollectionDate, todayKey)
    }
  }).filter(row => row.netBalance > 0)
}

const isRiskyDebtor = (row: DebtorRow) => {
  if(row.netBalance >= HIGH_RISK_BALANCE) return true
  if(row.netBalance >= MEDIUM_RISK_BALANCE) return true
  if(row.daysSinceLastCollection !== undefined && row.daysSinceLastCollection >= HIGH_RISK_DAYS) return true
  if(row.daysSinceLastCollection !== undefined && row.daysSinceLastCollection >= MEDIUM_RISK_DAYS) return true
  return false
}

const getEmployeeName = (employee?: Employee) => employee?.fullName || '-'

const getTopPerformanceEmployee = (employees: Employee[], performances: EmployeePerformance[], startDate: string, endDate: string) => {
  const rows = employees.map(employee => {
    const records = performances.filter(performance => {
      return performance.employeeId === employee.id && isDateInRange(performance.workDate, startDate, endDate)
    })
    const totalScore = records.reduce((sum, record) => sum + record.performanceScore, 0)

    return {
      employee,
      recordCount: records.length,
      averageScore: records.length > 0 ? Math.round(totalScore / records.length) : 0
    }
  }).filter(row => row.recordCount > 0)

  return rows.sort((first, second) => {
    const scoreDiff = second.averageScore - first.averageScore
    if(scoreDiff !== 0) return scoreDiff
    return first.employee.fullName.localeCompare(second.employee.fullName, 'tr-TR')
  })[0]
}

const getTopBonusEmployee = (employees: Employee[], bonuses: EmployeeBonus[], period: string) => {
  const rows = employees.map(employee => {
    const totalBonus = sumMoney(bonuses
      .filter(bonus => bonus.employeeId === employee.id && bonus.period === period && bonus.status !== 'İptal')
      .map(bonus => bonus.bonusAmount))

    return {
      employee,
      totalBonus
    }
  }).filter(row => row.totalBonus > 0)

  return rows.sort((first, second) => {
    const bonusDiff = second.totalBonus - first.totalBonus
    if(bonusDiff !== 0) return bonusDiff
    return first.employee.fullName.localeCompare(second.employee.fullName, 'tr-TR')
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

function KpiCard({ label, value, detail, compact = false }: KpiCardProps){
  return (
    <div className={`metric-card dashboard-kpi-card ${compact ? 'compact compact-metric-card' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p className="muted">{detail}</p>}
    </div>
  )
}

function SummaryPanel({ title, description, badge, items }: SummaryPanelProps){
  return (
    <section className="card financial-summary-card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        {badge}
      </div>
      <div className="financial-summary-values">
        {items.map(item => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail && <p className="muted small-text">{item.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function BusinessSummary(){
  const [tables] = React.useState<TableState[]>(() => loadTables())
  const [closedBills] = React.useState<ClosedBill[]>(() => loadClosed())
  const [products] = React.useState<Product[]>(() => loadProducts())
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [cashClosings] = React.useState<CashClosing[]>(() => loadCashClosings())
  const [supplierDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [supplierPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [attendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [performances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [bonuses] = React.useState<EmployeeBonus[]>(() => loadEmployeeBonuses())
  const [audits] = React.useState<EmployeeAudit[]>(() => loadEmployeeAudits())
  const [kitchenOrders] = React.useState<KitchenOrder[]>(() => loadKitchenOrders())
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [stockExpiryLots] = React.useState<StockExpiryLot[]>(() => loadStockExpiryLots())

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const weekStart = React.useMemo(() => getWeekStart(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const currentPeriod = todayKey.slice(0, 7)

  const revenueBills = React.useMemo(() => closedBills.filter(isRevenueBill), [closedBills])
  const todayBills = revenueBills.filter(bill => getLocalDateKey(bill.timestamp) === todayKey)
  const weekBills = revenueBills.filter(bill => isDateInRange(getLocalDateKey(bill.timestamp), weekStart, todayKey))
  const monthBills = revenueBills.filter(bill => isDateInRange(getLocalDateKey(bill.timestamp), monthStart, todayKey))

  const todayRevenue = sumMoney(todayBills.map(bill => bill.total))
  const weekRevenue = sumMoney(weekBills.map(bill => bill.total))
  const monthRevenue = sumMoney(monthBills.map(bill => bill.total))
  const occupiedTables = tables.filter(table => table.open)
  const openBillCount = tables.filter(table => table.open && table.orders.length > 0).length
  const activeEmployees = employees.filter(employee => employee.isActive)
  const activeProducts = products.filter(product => product.active)

  const closedBillPaymentTotal = sumMoney(revenueBills.flatMap(bill => getBillPayments(bill).map(payment => payment.amount)))
  const cashIncome = sumAmounts(cashTransactions.filter(transaction => transaction.type === 'Gelir'))
  const cashExpense = sumAmounts(cashTransactions.filter(transaction => transaction.type === 'Gider'))
  const collectionTotal = sumAmounts(collections)
  const supplierPaymentTotal = sumAmounts(supplierPayments)
  const fallbackCashBalance = roundCurrency(closedBillPaymentTotal + collectionTotal + cashIncome - supplierPaymentTotal - cashExpense)
  const cashBalance = getLatestClosingBalance(cashClosings) ?? fallbackCashBalance
  const totalReceivable = roundCurrency(credits
    .filter(transaction => transaction.status === 'Açık')
    .reduce((sum, transaction) => sum + transaction.remainingAmount, 0))
  const totalDebt = roundCurrency(supplierDebts
    .filter(debt => debt.status === 'Açık')
    .reduce((sum, debt) => sum + debt.remainingAmount, 0))
  const openCreditCount = credits.filter(transaction => transaction.status === 'Açık').length

  const activeTableOrderCount = countOrderItems(tables.flatMap(table => table.orders))
  const completedOrderCount = countOrderItems(todayBills.flatMap(bill => bill.orders))
  const todayOrderCount = completedOrderCount + activeTableOrderCount
  const preparedOrderCount = countKitchenItems(kitchenOrders.filter(order => order.status === 'Hazır'))
  const pendingOrderCount = countKitchenItems(kitchenOrders.filter(order => order.status === 'Yeni Sipariş' || order.status === 'Hazırlanıyor'))

  const todayAttendance = attendances.filter(attendance => attendance.workDate === todayKey)
  const todayWorkedMinutes = todayAttendance.reduce((sum, attendance) => sum + attendance.workedMinutes, 0)
  const topPerformance = getTopPerformanceEmployee(employees, performances, monthStart, todayKey)
  const topBonus = getTopBonusEmployee(employees, bonuses, currentPeriod)

  const criticalStockCount = stockItems.filter(isCriticalStock).length
  const expiryRiskCount = getExpiryRiskCount(stockExpiryLots, stockItems, today)
  const riskyCurrentCount = buildDebtorRows({
    accounts,
    credits,
    collections,
    todayKey
  }).filter(isRiskyDebtor).length
  const criticalDisciplineCount = audits.filter(audit => audit.severity === 'Kritik').length

  const mainKpis = [
    { label: 'Bugünkü Gelir', value: formatCurrency(todayRevenue), detail: `${formatNumber(todayBills.length)} kapanan işlem` },
    { label: 'Bu Haftaki Gelir', value: formatCurrency(weekRevenue), detail: `${weekStart} - ${todayKey}` },
    { label: 'Bu Aylık Gelir', value: formatCurrency(monthRevenue), detail: currentPeriod },
    { label: 'Açık İşlem Sayısı', value: formatNumber(openBillCount), detail: `${formatNumber(occupiedTables.length)} aktif alan` }
  ]

  const extraKpis = [
    { label: 'Toplam Alan', value: formatNumber(tables.length), detail: 'Tanımlı alan' },
    { label: 'Aktif Alan', value: formatNumber(occupiedTables.length), detail: tables.length > 0 ? `${formatNumber(tables.length - occupiedTables.length)} uygun alan` : 'Alan yok' },
    { label: 'Aktif Personel', value: formatNumber(activeEmployees.length), detail: `${formatNumber(employees.length)} toplam personel` },
    { label: 'Toplam Ürün', value: formatNumber(products.length), detail: `${formatNumber(activeProducts.length)} aktif ürün` }
  ]

  const financeItems: SummaryItem[] = [
    {
      label: 'Kasadaki Tutar',
      value: formatCurrency(cashBalance),
      detail: cashClosings.length > 0 ? 'Son gün sonu kapanışı' : 'Kayıtlı hareketlerden hesaplandı'
    },
    { label: 'Toplam Alacak', value: formatCurrency(totalReceivable), detail: `${formatNumber(openCreditCount)} açık veresiye` },
    { label: 'Toplam Borç', value: formatCurrency(totalDebt), detail: 'Açık tedarikçi borçları' },
    { label: 'Açık Veresiye', value: formatNumber(openCreditCount), detail: formatCurrency(totalReceivable) }
  ]

  const operationItems: SummaryItem[] = [
    { label: 'Bugünkü Talep Sayısı', value: formatNumber(todayOrderCount), detail: 'Kapanan ve açık işlem talepleri' },
    { label: 'Tamamlanan Talep', value: formatNumber(completedOrderCount), detail: 'Bugün kapanan işlemler' },
    { label: 'Hazırlanan Talep', value: formatNumber(preparedOrderCount), detail: 'Hazır durumunda' },
    { label: 'Bekleyen Talep', value: formatNumber(pendingOrderCount), detail: 'Yeni veya hazırlanıyor' }
  ]

  const personnelItems: SummaryItem[] = [
    { label: 'Aktif Personel', value: formatNumber(activeEmployees.length), detail: 'Çalışır durumdaki personel' },
    { label: 'Bugünkü Mesai', value: formatMinutes(todayWorkedMinutes), detail: `${formatNumber(todayAttendance.length)} puantaj kaydı` },
    {
      label: 'En Yüksek Performanslı Personel',
      value: getEmployeeName(topPerformance?.employee),
      detail: topPerformance ? `${formatNumber(topPerformance.averageScore)} ortalama puan` : 'Bu ay kayıt yok'
    },
    {
      label: 'En Yüksek Prim Alan Personel',
      value: getEmployeeName(topBonus?.employee),
      detail: topBonus ? formatCurrency(topBonus.totalBonus) : 'Bu ay prim yok'
    }
  ]

  const riskItems: SummaryItem[] = [
    { label: 'Kritik Stok Sayısı', value: formatNumber(criticalStockCount), detail: 'Min. seviyede veya altında' },
    { label: 'Geçerlilik Riski', value: formatNumber(expiryRiskCount), detail: 'Yaklaşan veya tarihi geçmiş lot' },
    { label: 'Riskli Cari Sayısı', value: formatNumber(riskyCurrentCount), detail: 'Bakiye veya tahsilat gecikmesi' },
    { label: 'Kritik Disiplin Kaydı', value: formatNumber(criticalDisciplineCount), detail: 'Personel denetim kayıtları' }
  ]

  return (
    <div className="business-summary-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Genel İşletme Özeti</h2>
          <p className="muted">İşletmenin güncel durumunu tek ekrandan takip edin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">Canlı özet</span>
          <span className="dashboard-date-pill">{todayKey}</span>
        </div>
      </div>

      <div className="metric-grid dashboard-kpi-grid">
        {mainKpis.map(item => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
          />
        ))}
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid business-summary-extra-grid">
        {extraKpis.map(item => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
            compact
          />
        ))}
      </div>

      <section className="business-summary-grid">
        <SummaryPanel
          title="Finans Özeti"
          description="Kasa, alacak, borç ve açık veresiye görünümü."
          badge={<span className={`status-pill ${cashBalance >= 0 ? 'success' : 'danger-pill'}`}>Kasa {cashBalance >= 0 ? 'pozitif' : 'negatif'}</span>}
          items={financeItems}
        />

        <SummaryPanel
          title="Operasyon Özeti"
          description="Bugünkü talep akışı ve hazırlık durumları."
          badge={<span className={`status-pill ${pendingOrderCount > 0 ? 'warning-pill' : 'success'}`}>{pendingOrderCount > 0 ? `${formatNumber(pendingOrderCount)} bekleyen` : 'Bekleyen yok'}</span>}
          items={operationItems}
        />

        <SummaryPanel
          title="Personel Özeti"
          description="Aktif ekip, mesai ve güncel personel performansı."
          badge={<span className="status-pill info-pill">{formatNumber(activeEmployees.length)} aktif</span>}
          items={personnelItems}
        />

        <SummaryPanel
          title="Risk Özeti"
          description="Stok, geçerlilik, cari ve disiplin riskleri."
          badge={<span className={`status-pill ${criticalStockCount + expiryRiskCount + riskyCurrentCount + criticalDisciplineCount > 0 ? 'danger-pill' : 'success'}`}>{criticalStockCount + expiryRiskCount + riskyCurrentCount + criticalDisciplineCount > 0 ? 'Risk var' : 'Risk yok'}</span>}
          items={riskItems}
        />
      </section>
    </div>
  )
}
