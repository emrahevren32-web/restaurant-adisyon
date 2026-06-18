import React from 'react'
import {
  CashClosing,
  CashTransaction,
  CollectionTransaction,
  CreditTransaction,
  CurrentAccount,
  CurrentAccountType,
  IncomeExpense,
  SupplierDebt,
  SupplierPayment
} from '../types'
import {
  loadCashClosings,
  loadCashTransactions,
  loadCollectionTransactions,
  loadCreditTransactions,
  loadCurrentAccounts,
  loadIncomeExpenses,
  loadSupplierDebts,
  loadSupplierPayments
} from '../storage'
import { formatCurrency, roundCurrency } from '../billing'

type DateRangeMode = 'today' | 'week' | 'month' | 'year' | 'custom'
type AccountTypeFilter = CurrentAccountType | 'all'
type RiskLevel = 'Yüksek' | 'Orta' | 'Düşük'

type KpiCardProps = {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  compact?: boolean
}

type AccountBalanceRow = {
  account: CurrentAccount
  totalCredit: number
  totalCollection: number
  netBalance: number
  openCreditAmount: number
  openCreditCount: number
  lastCreditDate: string
  lastCollectionDate: string
  daysSinceLastCollection?: number
  riskLevel: RiskLevel
  riskReason: string
}

type SupplierBalanceRow = {
  account: CurrentAccount
  totalDebt: number
  totalPayment: number
  remainingDebt: number
  openDebtCount: number
  lastDebtDate: string
  lastPaymentDate: string
  daysSinceLastDebt?: number
}

type RiskListItem = {
  id: string
  title: string
  detail: string
  value: React.ReactNode
}

const accountTypes: CurrentAccountType[] = ['Müşteri', 'Firma', 'Personel', 'Tedarikçi']
const HIGH_RISK_BALANCE = 10000
const MEDIUM_RISK_BALANCE = 5000
const HIGH_RISK_DAYS = 60
const MEDIUM_RISK_DAYS = 30
const OVERDUE_SUPPLIER_DAYS = 30

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

const getPreviousRange = (startDate: string, endDate: string) => {
  const dayCount = getDaysBetween(startDate, endDate)
  if(dayCount <= 0) return { startDate: '', endDate: '' }

  const previousEndDate = addDays(startDate, -1)
  return {
    startDate: addDays(previousEndDate, -(dayCount - 1)),
    endDate: previousEndDate
  }
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
const formatPercent = (value: number) => `%${formatNumber(Math.round(value))}`

const sumAmounts = <T extends { amount: number }>(items: T[]) => {
  return roundCurrency(items.reduce((sum, item) => sum + item.amount, 0))
}

const getLastDate = (dates: string[]) => {
  return dates.reduce((latest, date) => {
    if(!latest) return date
    return date > latest ? date : latest
  }, '')
}

const getDaysSince = (dateKey: string, todayKey: string) => {
  if(!dateKey) return undefined

  const date = new Date(`${dateKey}T00:00:00`)
  const today = new Date(`${todayKey}T00:00:00`)
  if(Number.isNaN(date.getTime()) || Number.isNaN(today.getTime())) return undefined

  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

const getLatestClosingBalance = (closings: CashClosing[]) => {
  const latestClosing = [...closings].sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })[0]

  return latestClosing?.actualBalance
}

const getAccountName = (accountMap: Map<string, CurrentAccount>, accountId: string) => {
  return accountMap.get(accountId)?.name || 'Cari bulunamadı'
}

const getRiskResult = (netBalance: number, daysSinceLastCollection?: number) => {
  const highReasons: string[] = []
  const mediumReasons: string[] = []

  if(netBalance >= HIGH_RISK_BALANCE) highReasons.push('Yüksek bakiye')
  if(daysSinceLastCollection !== undefined && daysSinceLastCollection >= HIGH_RISK_DAYS){
    highReasons.push('60+ gün tahsilat yok')
  }

  if(highReasons.length > 0){
    return {
      riskLevel: 'Yüksek' as const,
      riskReason: highReasons.join(' / ')
    }
  }

  if(netBalance >= MEDIUM_RISK_BALANCE) mediumReasons.push('Orta bakiye')
  if(daysSinceLastCollection !== undefined && daysSinceLastCollection >= MEDIUM_RISK_DAYS){
    mediumReasons.push('30+ gün tahsilat yok')
  }

  if(mediumReasons.length > 0){
    return {
      riskLevel: 'Orta' as const,
      riskReason: mediumReasons.join(' / ')
    }
  }

  return {
    riskLevel: 'Düşük' as const,
    riskReason: 'Düşük risk'
  }
}

const getRiskPillClass = (riskLevel: RiskLevel) => {
  if(riskLevel === 'Yüksek') return 'danger-pill'
  if(riskLevel === 'Orta') return 'warning-pill'
  return 'success'
}

const buildAccountRows = ({
  accounts,
  credits,
  collections,
  todayKey
}: {
  accounts: CurrentAccount[]
  credits: CreditTransaction[]
  collections: CollectionTransaction[]
  todayKey: string
}): AccountBalanceRow[] => {
  return accounts.map(account => {
    const accountCredits = credits.filter(transaction => transaction.currentAccountId === account.id)
    const accountCollections = collections.filter(transaction => transaction.currentAccountId === account.id)
    const totalCredit = sumAmounts(accountCredits)
    const totalCollection = sumAmounts(accountCollections)
    const netBalance = roundCurrency(Math.max(0, totalCredit - totalCollection))
    const openCreditAmount = roundCurrency(accountCredits
      .filter(transaction => transaction.status === 'Açık')
      .reduce((sum, transaction) => sum + transaction.remainingAmount, 0))
    const lastCreditDate = getLastDate(accountCredits.map(transaction => transaction.date))
    const lastCollectionDate = getLastDate(accountCollections.map(transaction => transaction.date))
    const daysSinceLastCollection = getDaysSince(lastCollectionDate, todayKey)
    const risk = getRiskResult(netBalance, daysSinceLastCollection)

    return {
      account,
      totalCredit,
      totalCollection,
      netBalance,
      openCreditAmount,
      openCreditCount: accountCredits.filter(transaction => transaction.status === 'Açık').length,
      lastCreditDate,
      lastCollectionDate,
      daysSinceLastCollection,
      riskLevel: risk.riskLevel,
      riskReason: risk.riskReason
    }
  }).sort((first, second) => {
    if(second.netBalance !== first.netBalance) return second.netBalance - first.netBalance
    return first.account.name.localeCompare(second.account.name, 'tr-TR')
  })
}

const buildSupplierRows = ({
  supplierAccounts,
  debts,
  payments,
  todayKey
}: {
  supplierAccounts: CurrentAccount[]
  debts: SupplierDebt[]
  payments: SupplierPayment[]
  todayKey: string
}): SupplierBalanceRow[] => {
  return supplierAccounts.map(account => {
    const accountDebts = debts.filter(debt => debt.currentAccountId === account.id)
    const accountPayments = payments.filter(payment => payment.currentAccountId === account.id)
    const totalDebt = sumAmounts(accountDebts)
    const totalPayment = sumAmounts(accountPayments)
    const remainingDebt = roundCurrency(accountDebts
      .filter(debt => debt.status === 'Açık')
      .reduce((sum, debt) => sum + debt.remainingAmount, 0))
    const lastDebtDate = getLastDate(accountDebts.map(debt => debt.date))
    const lastPaymentDate = getLastDate(accountPayments.map(payment => payment.date))

    return {
      account,
      totalDebt,
      totalPayment,
      remainingDebt,
      openDebtCount: accountDebts.filter(debt => debt.status === 'Açık').length,
      lastDebtDate,
      lastPaymentDate,
      daysSinceLastDebt: getDaysSince(lastDebtDate, todayKey)
    }
  }).sort((first, second) => {
    if(second.remainingDebt !== first.remainingDebt) return second.remainingDebt - first.remainingDebt
    return first.account.name.localeCompare(second.account.name, 'tr-TR')
  })
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

function SummaryPanel({
  title,
  description,
  badge,
  items
}: {
  title: string
  description: string
  badge: React.ReactNode
  items: { label: string; value: React.ReactNode; detail?: React.ReactNode }[]
}){
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

function RiskList({ title, items, emptyText }: { title: string; items: RiskListItem[]; emptyText: string }){
  return (
    <section className="card finance-risk-card">
      <div className="section-header compact dashboard-panel-header">
        <div>
          <h3>{title}</h3>
        </div>
        <span className={`status-pill ${items.length > 0 ? 'warning-pill' : 'success'}`}>
          {items.length > 0 ? `${formatNumber(items.length)} kayıt` : 'Temiz'}
        </span>
      </div>
      <div className="current-report-mini-list">
        {items.length === 0 && <p className="muted">{emptyText}</p>}
        {items.map(item => (
          <div className="current-report-mini-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <div>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function CurrentFinanceCenter(){
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [supplierDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [supplierPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [cashClosings] = React.useState<CashClosing[]>(() => loadCashClosings())
  const [incomeExpenses] = React.useState<IncomeExpense[]>(() => loadIncomeExpenses())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')
  const [accountTypeFilter, setAccountTypeFilter] = React.useState<AccountTypeFilter>('all')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const monthStart = React.useMemo(() => getMonthStart(today), [today])
  const last30Start = React.useMemo(() => addDays(todayKey, -29), [todayKey])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])
  const previousRange = React.useMemo(() => getPreviousRange(range.startDate, range.endDate), [range.endDate, range.startDate])
  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter(account => accountTypeFilter === 'all' || account.type === accountTypeFilter)
  }, [accountTypeFilter, accounts])
  const filteredAccountIds = React.useMemo(() => new Set(filteredAccounts.map(account => account.id)), [filteredAccounts])
  const filterRange = React.useCallback(<T extends { date: string }>(items: T[]) => {
    return items.filter(item => isDateInRange(item.date, range.startDate, range.endDate))
  }, [range.endDate, range.startDate])
  const filterPreviousRange = React.useCallback(<T extends { date: string }>(items: T[]) => {
    return items.filter(item => isDateInRange(item.date, previousRange.startDate, previousRange.endDate))
  }, [previousRange.endDate, previousRange.startDate])

  const filteredCredits = React.useMemo(() => {
    return filterRange(credits).filter(transaction => filteredAccountIds.has(transaction.currentAccountId))
  }, [credits, filterRange, filteredAccountIds])
  const filteredCollections = React.useMemo(() => {
    return filterRange(collections).filter(transaction => filteredAccountIds.has(transaction.currentAccountId))
  }, [collections, filterRange, filteredAccountIds])
  const filteredSupplierDebts = React.useMemo(() => {
    return filterRange(supplierDebts).filter(debt => filteredAccountIds.has(debt.currentAccountId))
  }, [filterRange, filteredAccountIds, supplierDebts])
  const filteredSupplierPayments = React.useMemo(() => {
    return filterRange(supplierPayments).filter(payment => filteredAccountIds.has(payment.currentAccountId))
  }, [filterRange, filteredAccountIds, supplierPayments])
  const filteredCashTransactions = React.useMemo(() => filterRange(cashTransactions), [cashTransactions, filterRange])
  const filteredCashClosings = React.useMemo(() => filterRange(cashClosings), [cashClosings, filterRange])
  const filteredIncomeExpenses = React.useMemo(() => filterRange(incomeExpenses), [filterRange, incomeExpenses])
  const previousCashTransactions = React.useMemo(() => filterPreviousRange(cashTransactions), [cashTransactions, filterPreviousRange])
  const previousIncomeExpenses = React.useMemo(() => filterPreviousRange(incomeExpenses), [filterPreviousRange, incomeExpenses])
  const previousCollections = React.useMemo(() => {
    return filterPreviousRange(collections).filter(transaction => filteredAccountIds.has(transaction.currentAccountId))
  }, [collections, filterPreviousRange, filteredAccountIds])
  const previousSupplierPayments = React.useMemo(() => {
    return filterPreviousRange(supplierPayments).filter(payment => filteredAccountIds.has(payment.currentAccountId))
  }, [filterPreviousRange, filteredAccountIds, supplierPayments])
  const monthCollections = React.useMemo(() => {
    return collections.filter(transaction => {
      return filteredAccountIds.has(transaction.currentAccountId) && isDateInRange(transaction.date, monthStart, todayKey)
    })
  }, [collections, filteredAccountIds, monthStart, todayKey])
  const monthSupplierPayments = React.useMemo(() => {
    return supplierPayments.filter(payment => {
      return filteredAccountIds.has(payment.currentAccountId) && isDateInRange(payment.date, monthStart, todayKey)
    })
  }, [filteredAccountIds, monthStart, supplierPayments, todayKey])
  const last30Collections = React.useMemo(() => {
    return collections.filter(transaction => {
      return filteredAccountIds.has(transaction.currentAccountId) && isDateInRange(transaction.date, last30Start, todayKey)
    })
  }, [collections, filteredAccountIds, last30Start, todayKey])

  const accountRows = React.useMemo(() => buildAccountRows({
    accounts: filteredAccounts,
    credits: filteredCredits,
    collections: filteredCollections,
    todayKey
  }), [filteredAccounts, filteredCollections, filteredCredits, todayKey])
  const supplierRows = React.useMemo(() => buildSupplierRows({
    supplierAccounts: filteredAccounts.filter(account => account.type === 'Tedarikçi'),
    debts: filteredSupplierDebts,
    payments: filteredSupplierPayments,
    todayKey
  }), [filteredAccounts, filteredSupplierDebts, filteredSupplierPayments, todayKey])

  const filteredCashIncome = filteredCashTransactions.filter(transaction => transaction.type === 'Gelir')
  const filteredCashExpense = filteredCashTransactions.filter(transaction => transaction.type === 'Gider')
  const filteredIncomeRecords = filteredIncomeExpenses.filter(record => record.type === 'Gelir')
  const filteredExpenseRecords = filteredIncomeExpenses.filter(record => record.type === 'Gider')
  const totalCredit = sumAmounts(filteredCredits)
  const totalCollection = sumAmounts(filteredCollections)
  const openCreditAmount = roundCurrency(filteredCredits
    .filter(transaction => transaction.status === 'Açık')
    .reduce((sum, transaction) => sum + transaction.remainingAmount, 0))
  const totalSupplierDebt = sumAmounts(filteredSupplierDebts)
  const totalSupplierPayment = sumAmounts(filteredSupplierPayments)
  const remainingSupplierDebt = roundCurrency(filteredSupplierDebts
    .filter(debt => debt.status === 'Açık')
    .reduce((sum, debt) => sum + debt.remainingAmount, 0))
  const cashIncome = roundCurrency(sumAmounts(filteredCollections) + sumAmounts(filteredCashIncome) + sumAmounts(filteredIncomeRecords))
  const cashExpense = roundCurrency(sumAmounts(filteredSupplierPayments) + sumAmounts(filteredCashExpense) + sumAmounts(filteredExpenseRecords))
  const cashNet = roundCurrency(cashIncome - cashExpense)
  const cashBalance = getLatestClosingBalance(filteredCashClosings) ?? cashNet
  const monthCollectionAmount = sumAmounts(monthCollections)
  const monthPaymentAmount = sumAmounts(monthSupplierPayments)
  const activeAccountCount = filteredAccounts.filter(account => account.isActive).length
  const riskyCurrentRows = accountRows.filter(row => row.netBalance > 0 && row.riskLevel !== 'Düşük')
  const topDebtor = accountRows.find(row => row.netBalance > 0)
  const topCollectionRow = [...accountRows]
    .filter(row => row.totalCollection > 0)
    .sort((first, second) => second.totalCollection - first.totalCollection || first.account.name.localeCompare(second.account.name, 'tr-TR'))[0]
  const topSupplier = supplierRows.find(row => row.remainingDebt > 0)
  const openCreditCount = filteredCredits.filter(transaction => transaction.status === 'Açık').length
  const closedCreditCount = filteredCredits.filter(transaction => transaction.status === 'Kapandı').length
  const closedCreditAmount = roundCurrency(filteredCredits
    .filter(transaction => transaction.status === 'Kapandı')
    .reduce((sum, transaction) => sum + transaction.amount, 0))
  const collectionRate = totalCredit > 0 ? Math.min(100, (totalCollection / totalCredit) * 100) : 0
  const collectionSuccessRate = openCreditAmount + totalCollection > 0
    ? Math.min(100, (totalCollection / (openCreditAmount + totalCollection)) * 100)
    : 0
  const previousIncome = roundCurrency(
    sumAmounts(previousCollections)
    + sumAmounts(previousCashTransactions.filter(transaction => transaction.type === 'Gelir'))
    + sumAmounts(previousIncomeExpenses.filter(record => record.type === 'Gelir'))
  )
  const previousExpense = roundCurrency(
    sumAmounts(previousSupplierPayments)
    + sumAmounts(previousCashTransactions.filter(transaction => transaction.type === 'Gider'))
    + sumAmounts(previousIncomeExpenses.filter(record => record.type === 'Gider'))
  )
  const previousNet = roundCurrency(previousIncome - previousExpense)
  const trendChange = roundCurrency(cashNet - previousNet)

  const accountSummaryItems = [
    { label: 'Toplam Cari', value: formatNumber(filteredAccounts.length), detail: `${formatNumber(activeAccountCount)} aktif cari` },
    { label: 'Müşteri Sayısı', value: formatNumber(filteredAccounts.filter(account => account.type === 'Müşteri').length) },
    { label: 'Firma Sayısı', value: formatNumber(filteredAccounts.filter(account => account.type === 'Firma').length) },
    { label: 'Tedarikçi Sayısı', value: formatNumber(filteredAccounts.filter(account => account.type === 'Tedarikçi').length) },
    { label: 'Personel Cari Sayısı', value: formatNumber(filteredAccounts.filter(account => account.type === 'Personel').length) }
  ]
  const creditSummaryItems = [
    { label: 'Açık Veresiye', value: formatCurrency(openCreditAmount), detail: `${formatNumber(openCreditCount)} açık kayıt` },
    { label: 'Kapatılan Veresiye', value: formatCurrency(closedCreditAmount), detail: `${formatNumber(closedCreditCount)} kapalı kayıt` },
    { label: 'Tahsilat Oranı %', value: formatPercent(collectionRate), detail: `${formatCurrency(totalCollection)} tahsilat` },
    { label: 'En Borçlu Cari', value: topDebtor?.account.name || '-', detail: topDebtor ? formatCurrency(topDebtor.netBalance) : 'Borçlu cari yok' }
  ]
  const collectionSummaryItems = [
    { label: 'Bu Ay Tahsilat', value: formatCurrency(monthCollectionAmount), detail: `${formatNumber(monthCollections.length)} işlem` },
    { label: 'Son 30 Gün Tahsilat', value: formatCurrency(sumAmounts(last30Collections)), detail: `${last30Start} - ${todayKey}` },
    { label: 'Tahsilat Başarı Oranı', value: formatPercent(collectionSuccessRate), detail: 'Tahsilat / açık risk havuzu' },
    { label: 'En Çok Tahsilat Yapılan Cari', value: topCollectionRow?.account.name || '-', detail: topCollectionRow ? formatCurrency(topCollectionRow.totalCollection) : 'Tahsilat yok' }
  ]
  const supplierSummaryItems = [
    { label: 'Toplam Tedarikçi Borcu', value: formatCurrency(totalSupplierDebt), detail: `${formatNumber(filteredSupplierDebts.length)} borç kaydı` },
    { label: 'Ödenen Borç', value: formatCurrency(totalSupplierPayment), detail: `${formatNumber(filteredSupplierPayments.length)} ödeme` },
    { label: 'Kalan Borç', value: formatCurrency(remainingSupplierDebt), detail: `${formatNumber(supplierRows.reduce((sum, row) => sum + row.openDebtCount, 0))} açık borç` },
    { label: 'En Borçlu Tedarikçi', value: topSupplier?.account.name || '-', detail: topSupplier ? formatCurrency(topSupplier.remainingDebt) : 'Açık borç yok' }
  ]
  const cashSummaryItems = [
    { label: 'Güncel Kasa', value: formatCurrency(cashBalance), detail: filteredCashClosings.length > 0 ? 'Son kasa kapanışı' : 'Hareketlerden hesaplandı' },
    { label: 'Toplam Gelir', value: formatCurrency(cashIncome), detail: 'Tahsilat, gelir ve kasa girişi' },
    { label: 'Toplam Gider', value: formatCurrency(cashExpense), detail: 'Ödeme, gider ve kasa çıkışı' },
    { label: 'Net Durum', value: formatCurrency(cashNet), detail: range.label }
  ]

  const highDebtItems: RiskListItem[] = accountRows
    .filter(row => row.netBalance >= MEDIUM_RISK_BALANCE)
    .slice(0, 5)
    .map(row => ({
      id: row.account.id,
      title: row.account.name,
      detail: `${row.account.type} / ${row.riskReason}`,
      value: formatCurrency(row.netBalance)
    }))
  const staleDebtItems: RiskListItem[] = accountRows
    .filter(row => row.netBalance > 0 && (row.daysSinceLastCollection === undefined || row.daysSinceLastCollection >= MEDIUM_RISK_DAYS))
    .sort((first, second) => (second.daysSinceLastCollection || 9999) - (first.daysSinceLastCollection || 9999))
    .slice(0, 5)
    .map(row => ({
      id: `stale_${row.account.id}`,
      title: row.account.name,
      detail: row.lastCollectionDate ? `Son tahsilat ${row.lastCollectionDate}` : 'Tahsilat kaydı yok',
      value: row.daysSinceLastCollection === undefined ? 'Yok' : `${formatNumber(row.daysSinceLastCollection)} gün`
    }))
  const overdueSupplierItems: RiskListItem[] = supplierRows
    .filter(row => row.remainingDebt > 0 && (row.daysSinceLastDebt || 0) >= OVERDUE_SUPPLIER_DAYS)
    .slice(0, 5)
    .map(row => ({
      id: `supplier_${row.account.id}`,
      title: row.account.name,
      detail: row.lastDebtDate ? `Borç tarihi ${row.lastDebtDate}` : 'Borç tarihi yok',
      value: formatCurrency(row.remainingDebt)
    }))
  const negativeTrendItems: RiskListItem[] = [
    cashNet < 0 ? {
      id: 'negative_net',
      title: 'Net durum negatif',
      detail: `${range.label} gelir-gider sonucu`,
      value: formatCurrency(cashNet)
    } : undefined,
    trendChange < 0 ? {
      id: 'trend_down',
      title: 'Önceki döneme göre düşüş',
      detail: `${formatCurrency(previousNet)} önceki net`,
      value: formatCurrency(trendChange)
    } : undefined
  ].filter(Boolean) as RiskListItem[]

  return (
    <div className="current-finance-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>Cari ve Finans Merkezi</h2>
          <p className="muted">Cari hesap ve finansal durumunuzu analiz edin.</p>
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
            <p className="muted">Tarih aralığı ve cari türü değiştiğinde tüm cari, tahsilat, tedarikçi, kasa ve risk analizleri güncellenir.</p>
          </div>
          <div className="toolbar-controls current-finance-filters">
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
            <select value={accountTypeFilter} onChange={event => setAccountTypeFilter(event.target.value as AccountTypeFilter)}>
              <option value="all">Tüm cari türleri</option>
              {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div className="metric-grid dashboard-kpi-grid">
        <KpiCard label="Toplam Alacak" value={formatCurrency(totalCredit)} detail={`${formatNumber(filteredCredits.length)} veresiye kaydı`} />
        <KpiCard label="Toplam Borç" value={formatCurrency(totalSupplierDebt)} detail={`${formatNumber(filteredSupplierDebts.length)} tedarikçi borcu`} />
        <KpiCard label="Kalan Veresiye" value={formatCurrency(openCreditAmount)} detail={`${formatNumber(openCreditCount)} açık kayıt`} />
        <KpiCard label="Kasadaki Tutar" value={formatCurrency(cashBalance)} detail={filteredCashClosings.length > 0 ? 'Kapanıştan alındı' : 'Hareketlerden hesaplandı'} />
      </div>

      <div className="metric-grid dashboard-panel-kpi-grid current-finance-extra-grid">
        <KpiCard compact label="Bu Ay Tahsilat" value={formatCurrency(monthCollectionAmount)} detail={`${formatNumber(monthCollections.length)} işlem`} />
        <KpiCard compact label="Bu Ay Ödeme" value={formatCurrency(monthPaymentAmount)} detail={`${formatNumber(monthSupplierPayments.length)} ödeme`} />
        <KpiCard compact label="Aktif Cari Sayısı" value={formatNumber(activeAccountCount)} detail={`${formatNumber(filteredAccounts.length)} toplam cari`} />
        <KpiCard compact label="Riskli Cari Sayısı" value={formatNumber(riskyCurrentRows.length)} detail="Orta ve yüksek risk" />
      </div>

      <section className="current-finance-summary-grid">
        <SummaryPanel
          title="Cari Özeti"
          description="Cari kartların tür ve aktiflik dağılımı."
          badge={<span className="status-pill info-pill">{formatNumber(filteredAccounts.length)} cari</span>}
          items={accountSummaryItems}
        />
        <SummaryPanel
          title="Veresiye Analizi"
          description="Açık ve kapanan veresiye kayıtları ile tahsilat oranı."
          badge={<span className={`status-pill ${openCreditAmount > 0 ? 'warning-pill' : 'success'}`}>{openCreditAmount > 0 ? 'Açık risk' : 'Temiz'}</span>}
          items={creditSummaryItems}
        />
        <SummaryPanel
          title="Tahsilat Analizi"
          description="Bu ay, son 30 gün ve başarı oranı görünümü."
          badge={<span className="status-pill success">{formatCurrency(totalCollection)}</span>}
          items={collectionSummaryItems}
        />
        <SummaryPanel
          title="Tedarikçi Analizi"
          description="Tedarikçi borcu, ödeme ve kalan borç görünümü."
          badge={<span className={`status-pill ${remainingSupplierDebt > 0 ? 'warning-pill' : 'success'}`}>{formatCurrency(remainingSupplierDebt)}</span>}
          items={supplierSummaryItems}
        />
        <SummaryPanel
          title="Kasa Analizi"
          description="Kasa girişi, çıkışı ve net finansal durum."
          badge={<span className={`status-pill ${cashNet >= 0 ? 'success' : 'danger-pill'}`}>Net {formatCurrency(cashNet)}</span>}
          items={cashSummaryItems}
        />
      </section>

      <section className="finance-risk-grid">
        <RiskList
          title="Yüksek Borçlu Cariler"
          items={highDebtItems}
          emptyText="Yüksek veya orta bakiye taşıyan cari bulunmuyor."
        />
        <RiskList
          title="Uzun Süredir Tahsil Edilmeyen Borçlar"
          items={staleDebtItems}
          emptyText="Tahsilat gecikmesi olan cari bulunmuyor."
        />
        <RiskList
          title="Gecikmiş Tedarikçi Borçları"
          items={overdueSupplierItems}
          emptyText="Gecikmiş tedarikçi borcu bulunmuyor."
        />
        <RiskList
          title="Negatif Finans Eğilimi"
          items={negativeTrendItems}
          emptyText="Seçili aralıkta negatif finans eğilimi yok."
        />
      </section>

      <section className="card">
        <div className="section-header compact dashboard-panel-header">
          <div>
            <h3>Cari Bakiye Listesi</h3>
            <p className="muted">Seçili aralıkta hareketi olan veya bakiye taşıyan ilk 12 cari.</p>
          </div>
          <span className="status-pill info-pill">{formatNumber(accountRows.length)} cari</span>
        </div>
        <div className="table-wrap">
          <table className="data-table current-finance-table">
            <thead>
              <tr>
                <th>Cari</th>
                <th>Tür</th>
                <th>Toplam Alacak</th>
                <th>Tahsilat</th>
                <th>Kalan Veresiye</th>
                <th>Net Bakiye</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.length === 0 && <tr><td className="empty-cell" colSpan={7}>Seçili filtrelerde cari hareket bulunmuyor.</td></tr>}
              {accountRows.slice(0, 12).map(row => (
                <tr key={row.account.id}>
                  <td>
                    <strong>{row.account.name}</strong>
                    <div className="muted small-text">{row.account.code}</div>
                  </td>
                  <td>{row.account.type}</td>
                  <td>{formatCurrency(row.totalCredit)}</td>
                  <td>{formatCurrency(row.totalCollection)}</td>
                  <td>{formatCurrency(row.openCreditAmount)}</td>
                  <td><strong>{formatCurrency(row.netBalance)}</strong></td>
                  <td>
                    <span className={`status-pill ${getRiskPillClass(row.riskLevel)}`}>
                      {row.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
