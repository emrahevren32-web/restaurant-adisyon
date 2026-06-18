import React from 'react'
import {
  Attendance,
  CashClosing,
  CashTransaction,
  CreditTransaction,
  CurrentAccount,
  Employee,
  EmployeeAudit,
  EmployeeBonus,
  EmployeePerformance,
  KitchenOrder,
  StockExpiryLot,
  StockItem,
  SupplierDebt,
  TableState
} from '../types'
import {
  loadAttendances,
  loadCashClosings,
  loadCashTransactions,
  loadCreditTransactions,
  loadCurrentAccounts,
  loadEmployeeAudits,
  loadEmployeeBonuses,
  loadEmployeePerformances,
  loadEmployees,
  loadKitchenOrders,
  loadStockExpiryLots,
  loadStockItems,
  loadSupplierDebts,
  loadTables
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'
import { formatStockQuantity, getCriticalRiskRatio, getCriticalShortage, isCriticalStock, isOutOfStock } from '../criticalStock'
import { formatExpiryDate, getDaysUntilExpiry, getExpiryStatus, getExpiryWarningDays, isExpiryTracked } from '../expiryStock'

type AlertPriority = 'Kritik' | 'Yüksek' | 'Orta' | 'Düşük'
type AlertCategory = 'Stok' | 'Finans' | 'Cari' | 'Personel' | 'Operasyon' | 'Sistem'
type PriorityFilter = AlertPriority | 'all'
type CategoryFilter = AlertCategory | 'all'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type ManagerAlert = {
  id: string
  category: AlertCategory
  priority: AlertPriority
  title: string
  subject: string
  detail: string
  score: number
  sortValue: number
  dateKey?: string
  stock?: {
    productName: string
    currentQty: number
    minQty: number
    shortage: number
    unit: StockItem['unit']
  }
  expiry?: {
    productName: string
    lotCode: string
    expiryDate?: string
    daysUntilExpiry: number | null
  }
  current?: {
    accountName: string
    debt: number
    delayText: string
  }
}

type EmployeeRiskRow = {
  employee: Employee
  averagePerformance: number
  performanceRecordCount: number
  warningCount: number
  highWarningCount: number
  criticalAuditCount: number
  absenceCount: number
  bonusAmount: number
}

const priorities: AlertPriority[] = ['Kritik', 'Yüksek', 'Orta', 'Düşük']
const categories: AlertCategory[] = ['Stok', 'Finans', 'Cari', 'Personel', 'Operasyon', 'Sistem']
const priorityScores: Record<AlertPriority, number> = { Kritik: 10, Yüksek: 5, Orta: 2, Düşük: 1 }
const priorityRanks: Record<AlertPriority, number> = { Kritik: 0, Yüksek: 1, Orta: 2, Düşük: 3 }

const HIGH_RISK_BALANCE = 10000
const MEDIUM_RISK_BALANCE = 5000
const HIGH_RISK_DAYS = 60
const MEDIUM_RISK_DAYS = 30
const LOW_PERFORMANCE_THRESHOLD = 50
const CRITICAL_PERFORMANCE_THRESHOLD = 25
const HIGH_WARNING_THRESHOLD = 2
const LONG_OPEN_ORDER_ITEM_THRESHOLD = 8
const VERY_LONG_OPEN_ORDER_ITEM_THRESHOLD = 12

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMonthStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
}

const getPreviousMonthRange = (today: Date) => {
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  return {
    startDate: getLocalDateKey(start),
    endDate: getLocalDateKey(end)
  }
}

const getDaysSince = (dateKey: string, todayKey: string) => {
  if(!dateKey) return undefined

  const date = new Date(`${dateKey}T00:00:00`)
  const today = new Date(`${todayKey}T00:00:00`)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return undefined

  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  if(startDate && dateKey < startDate) return false
  if(endDate && dateKey > endDate) return false
  return true
}

const getLastDate = (dates: string[]) => {
  return dates.reduce((latest, date) => {
    if(!latest) return date
    return date > latest ? date : latest
  }, '')
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatPercent = (value: number) => {
  return `%${formatNumber(Math.round(value))}`
}

const formatDays = (value?: number) => {
  if(value === undefined) return 'Tahsilat yok'
  if(value === 0) return 'Bugün'
  return `${formatNumber(value)} gün`
}

const getPriorityClass = (priority: AlertPriority) => {
  if(priority === 'Kritik') return 'danger-pill'
  if(priority === 'Yüksek') return 'warning-pill'
  if(priority === 'Orta') return 'info-pill'
  return 'muted-pill'
}

const createAlert = (alert: Omit<ManagerAlert, 'score'>): ManagerAlert => ({
  ...alert,
  score: priorityScores[alert.priority]
})

const sortAlerts = (alerts: ManagerAlert[]) => {
  return [...alerts].sort((first, second) => {
    const priorityDiff = priorityRanks[first.priority] - priorityRanks[second.priority]
    if(priorityDiff !== 0) return priorityDiff

    const scoreDiff = second.sortValue - first.sortValue
    if(scoreDiff !== 0) return scoreDiff

    return first.title.localeCompare(second.title, 'tr-TR')
  })
}

const sumMoney = (values: number[]) => {
  return roundCurrency(values.reduce((sum, value) => sum + value, 0))
}

const sumCashNet = (transactions: CashTransaction[], startDate = '', endDate = '') => {
  return roundCurrency(transactions
    .filter(transaction => isDateInRange(transaction.date, startDate, endDate))
    .reduce((sum, transaction) => {
      return transaction.type === 'Gelir'
        ? sum + transaction.amount
        : sum - transaction.amount
    }, 0))
}

const getLatestClosingBalance = (closings: CashClosing[]) => {
  const latestClosing = [...closings].sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })[0]

  return latestClosing?.actualBalance
}

const getStockPriority = (item: StockItem): AlertPriority => {
  if(isOutOfStock(item)) return 'Kritik'

  const riskRatio = getCriticalRiskRatio(item)
  if(riskRatio >= 0.5) return 'Yüksek'
  if(riskRatio > 0) return 'Orta'
  return 'Düşük'
}

const buildStockAlerts = (items: StockItem[]) => {
  return items
    .filter(isCriticalStock)
    .map(item => {
      const shortage = getCriticalShortage(item)
      const priority = getStockPriority(item)

      return createAlert({
        id: `stock_${item.id}`,
        category: 'Stok',
        priority,
        title: `Kritik stok: ${item.name}`,
        subject: item.name,
        detail: `Mevcut ${formatStockQuantity(item.currentQty, item.unit)} / minimum ${formatStockQuantity(item.minQty, item.unit)}`,
        sortValue: isOutOfStock(item) ? 9999 : shortage,
        stock: {
          productName: item.name,
          currentQty: item.currentQty,
          minQty: item.minQty,
          shortage,
          unit: item.unit
        }
      })
    })
}

const buildExpiryAlerts = (lots: StockExpiryLot[], stockItems: StockItem[], today: Date) => {
  const stockItemMap = new Map(stockItems.map(item => [item.id, item]))

  return lots.flatMap(lot => {
    const item = stockItemMap.get(lot.stockItemId)
    if(!item?.active || !isExpiryTracked(item) || lot.remainingQty <= 0) return []

    const warningDays = getExpiryWarningDays(item)
    const status = getExpiryStatus(lot, warningDays, today)
    if(status !== 'expired' && status !== 'near_expiry') return []

    const daysUntilExpiry = getDaysUntilExpiry(lot.expiryDate, today)
    const priority: AlertPriority = status === 'expired'
      ? 'Kritik'
      : daysUntilExpiry !== null && daysUntilExpiry <= 3 ? 'Yüksek' : 'Orta'
    const daysLabel = daysUntilExpiry === null
      ? 'SKT yok'
      : daysUntilExpiry < 0 ? `${Math.abs(daysUntilExpiry)} gün geçmiş` : `${formatNumber(daysUntilExpiry)} gün kaldı`

    return [createAlert({
      id: `expiry_${lot.id}`,
      category: 'Stok',
      priority,
      title: status === 'expired' ? `SKT geçti: ${lot.stockItemName}` : `SKT yaklaşıyor: ${lot.stockItemName}`,
      subject: lot.stockItemName,
      detail: `${lot.lotCode} lotu için ${daysLabel}`,
      sortValue: daysUntilExpiry === null ? 0 : Math.max(0, 30 - daysUntilExpiry),
      dateKey: lot.expiryDate,
      expiry: {
        productName: lot.stockItemName,
        lotCode: lot.lotCode,
        expiryDate: lot.expiryDate,
        daysUntilExpiry
      }
    })]
  })
}

const buildCurrentAlerts = (accounts: CurrentAccount[], credits: CreditTransaction[], todayKey: string) => {
  const accountMap = new Map(accounts.map(account => [account.id, account]))
  const accountIds = new Set(credits.map(credit => credit.currentAccountId))

  return Array.from(accountIds).flatMap(accountId => {
    const account = accountMap.get(accountId)
    if(!account) return []

    const openCredits = credits.filter(credit => credit.currentAccountId === accountId && credit.status === 'Açık')
    const debt = sumMoney(openCredits.map(credit => credit.remainingAmount))
    if(debt <= 0) return []

    const lastCreditDate = getLastDate(openCredits.map(credit => credit.date))
    const daysSinceLastCredit = getDaysSince(lastCreditDate, todayKey)
    const priority: AlertPriority = debt >= HIGH_RISK_BALANCE || (daysSinceLastCredit || 0) >= HIGH_RISK_DAYS
      ? 'Kritik'
      : debt >= MEDIUM_RISK_BALANCE || (daysSinceLastCredit || 0) >= MEDIUM_RISK_DAYS ? 'Yüksek' : 'Orta'
    const delayText = formatDays(daysSinceLastCredit)

    return [createAlert({
      id: `current_${account.id}`,
      category: 'Cari',
      priority,
      title: `Cari risk: ${account.name}`,
      subject: account.name,
      detail: `${formatCurrency(debt)} açık veresiye / ${delayText}`,
      sortValue: debt + ((daysSinceLastCredit || 0) * 100),
      dateKey: lastCreditDate,
      current: {
        accountName: account.name,
        debt,
        delayText
      }
    })]
  })
}

const buildFinanceAlerts = ({
  cashTransactions,
  cashClosings,
  supplierDebts,
  credits,
  today
}: {
  cashTransactions: CashTransaction[]
  cashClosings: CashClosing[]
  supplierDebts: SupplierDebt[]
  credits: CreditTransaction[]
  today: Date
}) => {
  const alerts: ManagerAlert[] = []
  const todayKey = getLocalDateKey(today)
  const monthStart = getMonthStart(today)
  const previousMonthRange = getPreviousMonthRange(today)
  const allCashNet = sumCashNet(cashTransactions)
  const cashBalance = getLatestClosingBalance(cashClosings) ?? allCashNet

  if(cashBalance < 0){
    alerts.push(createAlert({
      id: 'finance_negative_cash',
      category: 'Finans',
      priority: cashBalance <= -MEDIUM_RISK_BALANCE ? 'Kritik' : 'Yüksek',
      title: 'Negatif kasa',
      subject: 'Kasa',
      detail: `Güncel kasa bakiyesi ${formatCurrency(cashBalance)}`,
      sortValue: Math.abs(cashBalance),
      dateKey: todayKey
    }))
  }

  const currentMonthNet = sumCashNet(cashTransactions, monthStart, todayKey)
  const previousMonthNet = sumCashNet(cashTransactions, previousMonthRange.startDate, previousMonthRange.endDate)
  const trendChange = roundCurrency(currentMonthNet - previousMonthNet)
  if(trendChange < 0 && currentMonthNet < previousMonthNet){
    alerts.push(createAlert({
      id: 'finance_negative_trend',
      category: 'Finans',
      priority: trendChange <= -MEDIUM_RISK_BALANCE ? 'Yüksek' : 'Orta',
      title: 'Negatif finans eğilimi',
      subject: 'Nakit akışı',
      detail: `Bu ay net ${formatCurrency(currentMonthNet)}, önceki ay net ${formatCurrency(previousMonthNet)}`,
      sortValue: Math.abs(trendChange),
      dateKey: todayKey
    }))
  }

  const openSupplierDebt = sumMoney(supplierDebts
    .filter(debt => debt.status === 'Açık')
    .map(debt => debt.remainingAmount))
  if(openSupplierDebt > 0){
    alerts.push(createAlert({
      id: 'finance_supplier_debt',
      category: 'Finans',
      priority: openSupplierDebt >= HIGH_RISK_BALANCE ? 'Kritik' : openSupplierDebt >= MEDIUM_RISK_BALANCE ? 'Yüksek' : 'Orta',
      title: 'Yüksek tedarikçi borcu',
      subject: 'Tedarikçi borçları',
      detail: `${formatCurrency(openSupplierDebt)} açık tedarikçi borcu bulunuyor`,
      sortValue: openSupplierDebt,
      dateKey: todayKey
    }))
  }

  const totalCredit = sumMoney(credits.map(credit => credit.amount))
  const totalPaid = sumMoney(credits.map(credit => credit.paidAmount))
  const collectionRate = totalCredit > 0 ? (totalPaid / totalCredit) * 100 : 100
  if(totalCredit > 0 && collectionRate < 60){
    alerts.push(createAlert({
      id: 'finance_low_collection',
      category: 'Finans',
      priority: collectionRate < 30 ? 'Yüksek' : 'Orta',
      title: 'Düşük tahsilat',
      subject: 'Veresiye tahsilatı',
      detail: `Tahsilat oranı ${formatPercent(collectionRate)} / toplam ${formatCurrency(totalCredit)}`,
      sortValue: 100 - collectionRate,
      dateKey: todayKey
    }))
  }

  return alerts
}

const buildEmployeeRows = ({
  employees,
  attendances,
  performances,
  audits,
  bonuses
}: {
  employees: Employee[]
  attendances: Attendance[]
  performances: EmployeePerformance[]
  audits: EmployeeAudit[]
  bonuses: EmployeeBonus[]
}): EmployeeRiskRow[] => {
  const employeeIds = new Set([
    ...employees.map(employee => employee.id),
    ...attendances.map(attendance => attendance.employeeId),
    ...performances.map(performance => performance.employeeId),
    ...audits.map(audit => audit.employeeId),
    ...bonuses.map(bonus => bonus.employeeId)
  ])
  const employeeMap = new Map(employees.map(employee => [employee.id, employee]))

  return Array.from(employeeIds).map(employeeId => {
    const employee = employeeMap.get(employeeId) || {
      id: employeeId,
      code: employeeId,
      fullName: 'Personel bulunamadı',
      position: 'Diğer',
      phone: '',
      email: '',
      startDate: '',
      salary: 0,
      isActive: true,
      note: '',
      createdAt: '',
      updatedAt: ''
    } as Employee
    const employeePerformances = performances.filter(performance => performance.employeeId === employeeId)
    const performanceScore = employeePerformances.reduce((sum, performance) => sum + performance.performanceScore, 0)
    const employeeAudits = audits.filter(audit => audit.employeeId === employeeId)
    const employeeBonuses = bonuses.filter(bonus => bonus.employeeId === employeeId && bonus.status !== 'İptal')

    return {
      employee,
      averagePerformance: employeePerformances.length > 0 ? Math.round(performanceScore / employeePerformances.length) : 0,
      performanceRecordCount: employeePerformances.length,
      warningCount: employeeAudits.filter(audit => audit.recordType === 'Uyarı').length,
      highWarningCount: employeeAudits.filter(audit => audit.recordType === 'Uyarı' && (audit.severity === 'Yüksek' || audit.severity === 'Kritik')).length,
      criticalAuditCount: employeeAudits.filter(audit => audit.severity === 'Kritik').length,
      absenceCount: attendances.filter(attendance => attendance.employeeId === employeeId && attendance.status === 'Devamsız').length,
      bonusAmount: sumMoney(employeeBonuses.map(bonus => bonus.bonusAmount))
    }
  })
}

const buildPersonnelAlerts = (rows: EmployeeRiskRow[]) => {
  const alerts: ManagerAlert[] = []

  rows.forEach(row => {
    if(row.employee.isActive && row.performanceRecordCount > 0 && row.averagePerformance < LOW_PERFORMANCE_THRESHOLD){
      alerts.push(createAlert({
        id: `personnel_low_performance_${row.employee.id}`,
        category: 'Personel',
        priority: row.averagePerformance < CRITICAL_PERFORMANCE_THRESHOLD ? 'Yüksek' : 'Orta',
        title: 'Düşük performans',
        subject: row.employee.fullName,
        detail: `Ortalama performans ${formatNumber(row.averagePerformance)} / ${formatNumber(row.performanceRecordCount)} kayıt`,
        sortValue: LOW_PERFORMANCE_THRESHOLD - row.averagePerformance
      }))
    }

    if(row.criticalAuditCount > 0){
      alerts.push(createAlert({
        id: `personnel_critical_audit_${row.employee.id}`,
        category: 'Personel',
        priority: 'Kritik',
        title: 'Kritik disiplin kaydı',
        subject: row.employee.fullName,
        detail: `${formatNumber(row.criticalAuditCount)} kritik disiplin kaydı`,
        sortValue: row.criticalAuditCount * 100
      }))
    }

    if(row.warningCount >= HIGH_WARNING_THRESHOLD || row.highWarningCount > 0){
      alerts.push(createAlert({
        id: `personnel_high_warning_${row.employee.id}`,
        category: 'Personel',
        priority: row.highWarningCount > 0 ? 'Yüksek' : 'Orta',
        title: 'Yüksek uyarı sayısı',
        subject: row.employee.fullName,
        detail: `${formatNumber(row.warningCount)} uyarı / ${formatNumber(row.highWarningCount)} yüksek-kritik`,
        sortValue: row.warningCount + row.highWarningCount * 3
      }))
    }

    if(row.employee.isActive && row.absenceCount > 0){
      alerts.push(createAlert({
        id: `personnel_absence_${row.employee.id}`,
        category: 'Personel',
        priority: row.absenceCount >= 2 ? 'Yüksek' : 'Orta',
        title: 'Devamsızlık riski',
        subject: row.employee.fullName,
        detail: `${formatNumber(row.absenceCount)} devamsızlık kaydı / prim ${formatCurrency(row.bonusAmount)}`,
        sortValue: row.absenceCount
      }))
    }
  })

  return alerts
}

const countOrderItems = (table: TableState) => {
  return table.orders.reduce((sum, order) => sum + Math.max(0, Number(order.qty) || 0), 0)
}

const buildOperationAlerts = (tables: TableState[], kitchenOrders: KitchenOrder[]) => {
  const alerts: ManagerAlert[] = []
  const openTables = tables.filter(table => table.open)
  const totalTables = tables.length
  const occupiedRate = totalTables > 0 ? (openTables.length / totalTables) * 100 : 0
  const pendingOrders = kitchenOrders.filter(order => order.status !== 'Hazır')

  if(pendingOrders.length > 0){
    alerts.push(createAlert({
      id: 'operation_pending_orders',
      category: 'Operasyon',
      priority: pendingOrders.length >= 5 ? 'Yüksek' : 'Orta',
      title: 'Bekleyen siparişler',
      subject: 'Mutfak operasyonu',
      detail: `${formatNumber(pendingOrders.length)} sipariş yeni veya hazırlanıyor durumunda`,
      sortValue: pendingOrders.length
    }))
  }

  openTables
    .filter(table => countOrderItems(table) >= LONG_OPEN_ORDER_ITEM_THRESHOLD)
    .forEach(table => {
      const itemCount = countOrderItems(table)
      alerts.push(createAlert({
        id: `operation_open_bill_${table.id}`,
        category: 'Operasyon',
        priority: itemCount >= VERY_LONG_OPEN_ORDER_ITEM_THRESHOLD ? 'Yüksek' : 'Orta',
        title: 'Uzun süre açık adisyon riski',
        subject: table.name,
        detail: `${formatNumber(itemCount)} ürünlü açık adisyon takip edilmeli`,
        sortValue: itemCount
      }))
    })

  if(occupiedRate >= 60){
    alerts.push(createAlert({
      id: 'operation_table_utilization',
      category: 'Operasyon',
      priority: occupiedRate >= 80 ? 'Yüksek' : 'Orta',
      title: 'Yoğun masa kullanımı',
      subject: 'Salon doluluğu',
      detail: `${formatNumber(openTables.length)} / ${formatNumber(totalTables)} masa dolu (${formatPercent(occupiedRate)})`,
      sortValue: occupiedRate
    }))
  }

  return alerts
}

const buildSystemAlerts = (stockItems: StockItem[], expiryLots: StockExpiryLot[]) => {
  const activeLotStockIds = new Set(expiryLots.filter(lot => lot.remainingQty > 0).map(lot => lot.stockItemId))
  const alerts: ManagerAlert[] = []

  stockItems
    .filter(item => item.active && item.minQty <= 0)
    .forEach(item => {
      alerts.push(createAlert({
        id: `system_min_qty_${item.id}`,
        category: 'Sistem',
        priority: 'Düşük',
        title: 'Minimum stok seviyesi tanımsız',
        subject: item.name,
        detail: 'Minimum seviye 0 olduğu için kritik stok takibi zayıf kalır',
        sortValue: 1
      }))
    })

  stockItems
    .filter(item => item.active && isExpiryTracked(item) && !activeLotStockIds.has(item.id))
    .forEach(item => {
      alerts.push(createAlert({
        id: `system_expiry_lot_${item.id}`,
        category: 'Sistem',
        priority: 'Düşük',
        title: 'SKT takipli ürün için aktif lot yok',
        subject: item.name,
        detail: 'SKT riski üretmek için aktif lot kaydı bekleniyor',
        sortValue: 1
      }))
    })

  return alerts
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

function PriorityPill({ priority }: { priority: AlertPriority }){
  return <span className={`status-pill ${getPriorityClass(priority)}`}>{priority}</span>
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }){
  return <tr><td className="empty-cell" colSpan={colSpan}>{text}</td></tr>
}

function AlertSummaryTable({ alerts }: { alerts: ManagerAlert[] }){
  const topAlerts = sortAlerts(alerts).slice(0, 10)

  return (
    <section className="card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>Risk Özeti</h3>
          <p className="muted">En kritik 10 uyarı öncelik sırasına göre gösterilir.</p>
        </div>
        <span className="status-pill info-pill">{formatNumber(topAlerts.length)} uyarı</span>
      </div>
      <div className="table-wrap">
        <table className="data-table manager-alert-summary-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Uyarı</th>
              <th>Detay</th>
              <th>Puan</th>
              <th>Öncelik</th>
            </tr>
          </thead>
          <tbody>
            {topAlerts.length === 0 && <EmptyRow colSpan={5} text="Seçili filtrelerde uyarı bulunmuyor." />}
            {topAlerts.map(alert => (
              <tr key={alert.id}>
                <td><span className="status-pill info-pill">{alert.category}</span></td>
                <td>
                  <strong>{alert.title}</strong>
                  <div className="muted small-text">{alert.subject}</div>
                </td>
                <td>{alert.detail}</td>
                <td>{formatNumber(alert.score)}</td>
                <td><PriorityPill priority={alert.priority} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function ManagerAlertCenter(){
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [expiryLots] = React.useState<StockExpiryLot[]>(() => loadStockExpiryLots())
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [supplierDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [cashClosings] = React.useState<CashClosing[]>(() => loadCashClosings())
  const [employees] = React.useState<Employee[]>(() => loadEmployees())
  const [employeeAudits] = React.useState<EmployeeAudit[]>(() => loadEmployeeAudits())
  const [attendances] = React.useState<Attendance[]>(() => loadAttendances())
  const [performances] = React.useState<EmployeePerformance[]>(() => loadEmployeePerformances())
  const [bonuses] = React.useState<EmployeeBonus[]>(() => loadEmployeeBonuses())
  const [tables] = React.useState<TableState[]>(() => loadTables())
  const [kitchenOrders] = React.useState<KitchenOrder[]>(() => loadKitchenOrders())
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('all')
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])

  const stockAlerts = React.useMemo(() => buildStockAlerts(stockItems), [stockItems])
  const expiryAlerts = React.useMemo(() => buildExpiryAlerts(expiryLots, stockItems, today), [expiryLots, stockItems, today])
  const currentAlerts = React.useMemo(() => buildCurrentAlerts(accounts, credits, todayKey), [accounts, credits, todayKey])
  const financeAlerts = React.useMemo(() => buildFinanceAlerts({
    cashTransactions,
    cashClosings,
    supplierDebts,
    credits,
    today
  }), [cashClosings, cashTransactions, credits, supplierDebts, today])
  const employeeRows = React.useMemo(() => buildEmployeeRows({
    employees,
    attendances,
    performances,
    audits: employeeAudits,
    bonuses
  }), [attendances, bonuses, employeeAudits, employees, performances])
  const personnelAlerts = React.useMemo(() => buildPersonnelAlerts(employeeRows), [employeeRows])
  const operationAlerts = React.useMemo(() => buildOperationAlerts(tables, kitchenOrders), [kitchenOrders, tables])
  const systemAlerts = React.useMemo(() => buildSystemAlerts(stockItems, expiryLots), [expiryLots, stockItems])

  const allAlerts = React.useMemo(() => sortAlerts([
    ...stockAlerts,
    ...expiryAlerts,
    ...currentAlerts,
    ...financeAlerts,
    ...personnelAlerts,
    ...operationAlerts,
    ...systemAlerts
  ]), [currentAlerts, expiryAlerts, financeAlerts, operationAlerts, personnelAlerts, stockAlerts, systemAlerts])

  const visibleAlerts = React.useMemo(() => {
    return allAlerts.filter(alert => {
      const matchesPriority = priorityFilter === 'all' || alert.priority === priorityFilter
      const matchesCategory = categoryFilter === 'all' || alert.category === categoryFilter
      return matchesPriority && matchesCategory
    })
  }, [allAlerts, categoryFilter, priorityFilter])

  const getVisibleSectionAlerts = React.useCallback((alerts: ManagerAlert[]) => {
    const visibleIds = new Set(visibleAlerts.map(alert => alert.id))
    return sortAlerts(alerts.filter(alert => visibleIds.has(alert.id)))
  }, [visibleAlerts])

  const priorityCounts = priorities.reduce<Record<AlertPriority, number>>((counts, priority) => {
    counts[priority] = visibleAlerts.filter(alert => alert.priority === priority).length
    return counts
  }, { Kritik: 0, Yüksek: 0, Orta: 0, Düşük: 0 })
  const categoryCounts = categories.reduce<Record<AlertCategory, number>>((counts, category) => {
    counts[category] = visibleAlerts.filter(alert => alert.category === category).length
    return counts
  }, { Stok: 0, Finans: 0, Cari: 0, Personel: 0, Operasyon: 0, Sistem: 0 })
  const rawRiskScore = visibleAlerts.reduce((sum, alert) => sum + alert.score, 0)
  const riskScore = Math.min(100, rawRiskScore)
  const riskLevelClass = riskScore >= 70 ? 'danger-pill' : riskScore >= 35 ? 'warning-pill' : riskScore > 0 ? 'info-pill' : 'success'
  const stockSectionAlerts = getVisibleSectionAlerts(stockAlerts)
  const expirySectionAlerts = getVisibleSectionAlerts(expiryAlerts)
  const currentSectionAlerts = getVisibleSectionAlerts(currentAlerts)
  const financeSectionAlerts = getVisibleSectionAlerts(financeAlerts)
  const personnelSectionAlerts = getVisibleSectionAlerts(personnelAlerts)
  const operationSectionAlerts = getVisibleSectionAlerts(operationAlerts)
  const systemSectionAlerts = getVisibleSectionAlerts(systemAlerts)

  return (
    <div className="manager-alert-center-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Yönetici Uyarı Merkezi</h2>
          <p className="muted">İşletmedeki kritik durumları ve riskleri takip edin.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className={`status-pill ${riskLevelClass}`}>Risk {formatNumber(riskScore)}/100</span>
          <span className="dashboard-date-pill">{todayKey}</span>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">Öncelik veya kategori değiştiğinde uyarı listeleri, KPI kartları ve risk skoru güncellenir.</p>
          </div>
          <div className="toolbar-controls manager-alert-filters">
            <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}>
              <option value="all">Tümü</option>
              {priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as CategoryFilter)}>
              <option value="all">Tüm kategoriler</option>
              {categories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Kritik Uyarı" value={formatNumber(priorityCounts.Kritik)} detail={`${formatNumber(visibleAlerts.length)} toplam uyarı`} />
        <KpiCard label="Yüksek Öncelikli Uyarı" value={formatNumber(priorityCounts.Yüksek)} detail="5 puanlık uyarılar" />
        <KpiCard label="Orta Öncelikli Uyarı" value={formatNumber(priorityCounts.Orta)} detail="2 puanlık uyarılar" />
        <KpiCard label="Düşük Öncelikli Uyarı" value={formatNumber(priorityCounts.Düşük)} detail="1 puanlık uyarılar" />
      </div>

      <section className="manager-alert-score-grid">
        <section className="card manager-alert-score-card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Genel Risk Skoru</h3>
              <p className="muted">Kritik 10, yüksek 5, orta 2 ve düşük 1 puan üzerinden hesaplanır.</p>
            </div>
            <span className={`status-pill ${riskLevelClass}`}>{formatNumber(riskScore)}/100</span>
          </div>
          <div className="manager-risk-score-value">
            <strong>{formatNumber(riskScore)}</strong>
            <span>Ham puan: {formatNumber(rawRiskScore)}</span>
          </div>
          <div className="manager-risk-score-bar" aria-hidden="true">
            <span style={{ width: `${riskScore}%` }} />
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Uyarı Kategorileri</h3>
              <p className="muted">Filtreye göre kategori dağılımı.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(visibleAlerts.length)} uyarı</span>
          </div>
          <div className="metric-grid dashboard-panel-kpi-grid manager-alert-category-grid">
            {categories.map(category => (
              <KpiCard
                key={category}
                compact
                label={category}
                value={formatNumber(categoryCounts[category])}
                detail={`${formatNumber(allAlerts.filter(alert => alert.category === category).length)} genel kayıt`}
              />
            ))}
          </div>
        </section>
      </section>

      <AlertSummaryTable alerts={visibleAlerts} />

      <section className="manager-alert-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Kritik Stok Uyarıları</h3>
              <p className="muted">Mevcut miktarı minimum seviyede veya altında olan stoklar.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(stockSectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-stock-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Mevcut</th>
                  <th>Minimum</th>
                  <th>Eksik</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {stockSectionAlerts.length === 0 && <EmptyRow colSpan={5} text="Seçili filtrelerde kritik stok uyarısı yok." />}
                {stockSectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td><strong>{alert.stock?.productName || alert.subject}</strong></td>
                    <td>{alert.stock ? formatStockQuantity(alert.stock.currentQty, alert.stock.unit) : '-'}</td>
                    <td>{alert.stock ? formatStockQuantity(alert.stock.minQty, alert.stock.unit) : '-'}</td>
                    <td>{alert.stock ? formatStockQuantity(alert.stock.shortage, alert.stock.unit) : '-'}</td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>SKT Uyarıları</h3>
              <p className="muted">Tarihi geçen veya yaklaşan SKT lotları.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(expirySectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-expiry-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Lot</th>
                  <th>SKT</th>
                  <th>Kalan Gün</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {expirySectionAlerts.length === 0 && <EmptyRow colSpan={5} text="Seçili filtrelerde SKT uyarısı yok." />}
                {expirySectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td><strong>{alert.expiry?.productName || alert.subject}</strong></td>
                    <td>{alert.expiry?.lotCode || '-'}</td>
                    <td>{formatExpiryDate(alert.expiry?.expiryDate)}</td>
                    <td>
                      {alert.expiry?.daysUntilExpiry === null || alert.expiry?.daysUntilExpiry === undefined
                        ? '-'
                        : alert.expiry.daysUntilExpiry < 0
                          ? `${formatNumber(Math.abs(alert.expiry.daysUntilExpiry))} gün geçti`
                          : `${formatNumber(alert.expiry.daysUntilExpiry)} gün`}
                    </td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="manager-alert-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Cari Risk Uyarıları</h3>
              <p className="muted">Yüksek borçlu veya tahsilatı geciken cariler.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(currentSectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-current-table">
              <thead>
                <tr>
                  <th>Cari</th>
                  <th>Borç</th>
                  <th>Gecikme</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {currentSectionAlerts.length === 0 && <EmptyRow colSpan={4} text="Seçili filtrelerde cari risk uyarısı yok." />}
                {currentSectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td><strong>{alert.current?.accountName || alert.subject}</strong></td>
                    <td>{alert.current ? formatCurrency(alert.current.debt) : '-'}</td>
                    <td>{alert.current?.delayText || '-'}</td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Finans Uyarıları</h3>
              <p className="muted">Kasa, finans eğilimi, borç ve tahsilat problemleri.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(financeSectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-simple-table">
              <thead>
                <tr>
                  <th>Uyarı</th>
                  <th>Detay</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {financeSectionAlerts.length === 0 && <EmptyRow colSpan={3} text="Seçili filtrelerde finans uyarısı yok." />}
                {financeSectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td><strong>{alert.title}</strong></td>
                    <td>{alert.detail}</td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="manager-alert-grid">
        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Personel Uyarıları</h3>
              <p className="muted">Düşük performans, disiplin, uyarı ve devamsızlık riskleri.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(personnelSectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-personnel-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Sebep</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {personnelSectionAlerts.length === 0 && <EmptyRow colSpan={3} text="Seçili filtrelerde personel uyarısı yok." />}
                {personnelSectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td>
                      <strong>{alert.subject}</strong>
                      <div className="muted small-text">{alert.title}</div>
                    </td>
                    <td>{alert.detail}</td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact dashboard-panel-header">
            <div>
              <h3>Operasyon Uyarıları</h3>
              <p className="muted">Bekleyen siparişler, açık adisyon riski ve masa yoğunluğu.</p>
            </div>
            <span className="status-pill info-pill">{formatNumber(operationSectionAlerts.length)} kayıt</span>
          </div>
          <div className="table-wrap">
            <table className="data-table manager-alert-simple-table">
              <thead>
                <tr>
                  <th>Uyarı</th>
                  <th>Detay</th>
                  <th>Öncelik</th>
                </tr>
              </thead>
              <tbody>
                {operationSectionAlerts.length === 0 && <EmptyRow colSpan={3} text="Seçili filtrelerde operasyon uyarısı yok." />}
                {operationSectionAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td>
                      <strong>{alert.title}</strong>
                      <div className="muted small-text">{alert.subject}</div>
                    </td>
                    <td>{alert.detail}</td>
                    <td><PriorityPill priority={alert.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="card">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Sistem Uyarıları</h3>
            <p className="muted">Risk hesaplamalarını zayıflatabilecek veri ve yapılandırma eksikleri.</p>
          </div>
          <span className="status-pill info-pill">{formatNumber(systemSectionAlerts.length)} kayıt</span>
        </div>
        <div className="table-wrap">
          <table className="data-table manager-alert-system-table">
            <thead>
              <tr>
                <th>Uyarı</th>
                <th>Detay</th>
                <th>Öncelik</th>
              </tr>
            </thead>
            <tbody>
              {systemSectionAlerts.length === 0 && <EmptyRow colSpan={3} text="Seçili filtrelerde sistem uyarısı yok." />}
              {systemSectionAlerts.map(alert => (
                <tr key={alert.id}>
                  <td>
                    <strong>{alert.title}</strong>
                    <div className="muted small-text">{alert.subject}</div>
                  </td>
                  <td>{alert.detail}</td>
                  <td><PriorityPill priority={alert.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
