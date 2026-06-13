import React from 'react'
import {
  CashClosing,
  CashTransaction,
  CollectionTransaction,
  CreditTransaction,
  CurrentAccount,
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
import { formatCurrency } from '../billing'

type DateRangeMode = 'month' | 'year' | 'all' | 'custom'

type ReportLineItem = {
  id: string
  title: string
  subtitle: string
  date: string
  amount: number
}

type DebtorRow = {
  account: CurrentAccount
  totalDebt: number
  totalCollection: number
  netBalance: number
  lastCollectionDate: string
  daysSinceLastCollection?: number
}

type SupplierDebtRow = {
  debt: SupplierDebt
  supplierName: string
  amount: number
  remainingAmount: number
}

const HIGH_RISK_BALANCE = 10000
const MEDIUM_RISK_BALANCE = 5000
const HIGH_RISK_DAYS = 60
const MEDIUM_RISK_DAYS = 30

const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMonthStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1))
}

const getYearStart = (today: Date) => {
  return getLocalDateKey(new Date(today.getFullYear(), 0, 1))
}

const roundMoney = (value: number) => Math.round(value * 100) / 100
const sumAmounts = <T extends { amount: number }>(items: T[]) => roundMoney(items.reduce((sum, item) => sum + item.amount, 0))

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

  if(mode === 'custom'){
    return {
      startDate: customStartDate,
      endDate: customEndDate,
      label: 'Özel tarih'
    }
  }

  return {
    startDate: '',
    endDate: '',
    label: 'Tümü'
  }
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
    const netBalance = roundMoney(Math.max(0, totalDebt - totalCollection))
    const lastCollectionDate = getLastDate(accountCollections.map(transaction => transaction.date))

    return {
      account,
      totalDebt,
      totalCollection,
      netBalance,
      lastCollectionDate,
      daysSinceLastCollection: getDaysSince(lastCollectionDate, todayKey)
    }
  }).filter(row => row.netBalance > 0)
    .sort((first, second) => {
      if(second.netBalance !== first.netBalance) return second.netBalance - first.netBalance
      return first.account.name.localeCompare(second.account.name, 'tr-TR')
    })
}

const isRiskyDebtor = (row: DebtorRow) => {
  if(row.netBalance >= HIGH_RISK_BALANCE) return true
  if(row.netBalance >= MEDIUM_RISK_BALANCE) return true
  if(row.daysSinceLastCollection !== undefined && row.daysSinceLastCollection >= HIGH_RISK_DAYS) return true
  if(row.daysSinceLastCollection !== undefined && row.daysSinceLastCollection >= MEDIUM_RISK_DAYS) return true
  return false
}

const getAccountName = (accountMap: Map<string, CurrentAccount>, accountId: string) => {
  return accountMap.get(accountId)?.name || 'Cari bulunamadı'
}

const toIncomeItem = (record: IncomeExpense): ReportLineItem => ({
  id: `income_expense_${record.id}`,
  title: record.category,
  subtitle: record.description || 'Gelir gider kaydı',
  date: record.date,
  amount: record.amount
})

const toCashItem = (record: CashTransaction): ReportLineItem => ({
  id: `cash_${record.id}`,
  title: record.category,
  subtitle: record.description || 'Manuel kasa hareketi',
  date: record.date,
  amount: record.amount
})

export default function FinancialReports(){
  const [cashTransactions] = React.useState<CashTransaction[]>(() => loadCashTransactions())
  const [incomeExpenses] = React.useState<IncomeExpense[]>(() => loadIncomeExpenses())
  const [cashClosings] = React.useState<CashClosing[]>(() => loadCashClosings())
  const [supplierDebts] = React.useState<SupplierDebt[]>(() => loadSupplierDebts())
  const [supplierPayments] = React.useState<SupplierPayment[]>(() => loadSupplierPayments())
  const [credits] = React.useState<CreditTransaction[]>(() => loadCreditTransactions())
  const [collections] = React.useState<CollectionTransaction[]>(() => loadCollectionTransactions())
  const [accounts] = React.useState<CurrentAccount[]>(() => loadCurrentAccounts())
  const [rangeMode, setRangeMode] = React.useState<DateRangeMode>('month')
  const [customStartDate, setCustomStartDate] = React.useState('')
  const [customEndDate, setCustomEndDate] = React.useState('')

  const today = React.useMemo(() => new Date(), [])
  const todayKey = React.useMemo(() => getLocalDateKey(today), [today])
  const currentMonthStart = React.useMemo(() => getMonthStart(today), [today])
  const accountMap = React.useMemo(() => new Map(accounts.map(account => [account.id, account])), [accounts])
  const range = React.useMemo(() => getRangeDates({
    mode: rangeMode,
    customStartDate,
    customEndDate,
    today
  }), [customEndDate, customStartDate, rangeMode, today])

  const filterByRange = React.useCallback(<T extends { date: string }>(items: T[]) => {
    return items.filter(item => isDateInRange(item.date, range.startDate, range.endDate))
  }, [range.endDate, range.startDate])

  const filteredCashTransactions = React.useMemo(() => filterByRange(cashTransactions), [cashTransactions, filterByRange])
  const filteredIncomeExpenses = React.useMemo(() => filterByRange(incomeExpenses), [filterByRange, incomeExpenses])
  const filteredClosings = React.useMemo(() => filterByRange(cashClosings), [cashClosings, filterByRange])
  const filteredSupplierDebts = React.useMemo(() => filterByRange(supplierDebts), [filterByRange, supplierDebts])
  const filteredSupplierPayments = React.useMemo(() => filterByRange(supplierPayments), [filterByRange, supplierPayments])
  const filteredCredits = React.useMemo(() => filterByRange(credits), [credits, filterByRange])
  const filteredCollections = React.useMemo(() => filterByRange(collections), [collections, filterByRange])

  const filteredIncomeRecords = filteredIncomeExpenses.filter(record => record.type === 'Gelir')
  const filteredExpenseRecords = filteredIncomeExpenses.filter(record => record.type === 'Gider')
  const filteredCashIncome = filteredCashTransactions.filter(record => record.type === 'Gelir')
  const filteredCashExpense = filteredCashTransactions.filter(record => record.type === 'Gider')

  const totalIncome = roundMoney(sumAmounts(filteredIncomeRecords) + sumAmounts(filteredCashIncome))
  const totalExpense = roundMoney(sumAmounts(filteredExpenseRecords) + sumAmounts(filteredCashExpense))
  const netProfit = roundMoney(totalIncome - totalExpense)
  const totalCollection = sumAmounts(filteredCollections)
  const totalCredit = sumAmounts(filteredCredits)
  const totalSupplierDebt = sumAmounts(filteredSupplierDebts)
  const totalSupplierPayment = sumAmounts(filteredSupplierPayments)
  const openCreditAmount = roundMoney(filteredCredits
    .filter(transaction => transaction.status === 'Açık')
    .reduce((sum, transaction) => sum + transaction.remainingAmount, 0))
  const openSupplierDebtAmount = roundMoney(filteredSupplierDebts
    .filter(debt => debt.status === 'Açık')
    .reduce((sum, debt) => sum + debt.remainingAmount, 0))
  const fallbackCashBalance = roundMoney(
    sumAmounts(filteredCollections)
    + sumAmounts(filteredCashIncome)
    - sumAmounts(filteredSupplierPayments)
    - sumAmounts(filteredCashExpense)
  )
  const cashBalance = getLatestClosingBalance(filteredClosings) ?? fallbackCashBalance

  const monthIncomeItems = filteredIncomeExpenses.filter(record => {
    return record.type === 'Gelir' && isDateInRange(record.date, currentMonthStart, todayKey)
  })
  const monthExpenseItems = filteredIncomeExpenses.filter(record => {
    return record.type === 'Gider' && isDateInRange(record.date, currentMonthStart, todayKey)
  })
  const monthCashIncomeItems = filteredCashTransactions.filter(record => {
    return record.type === 'Gelir' && isDateInRange(record.date, currentMonthStart, todayKey)
  })
  const monthCashExpenseItems = filteredCashTransactions.filter(record => {
    return record.type === 'Gider' && isDateInRange(record.date, currentMonthStart, todayKey)
  })
  const monthIncome = roundMoney(sumAmounts(monthIncomeItems) + sumAmounts(monthCashIncomeItems))
  const monthExpense = roundMoney(sumAmounts(monthExpenseItems) + sumAmounts(monthCashExpenseItems))
  const monthNet = roundMoney(monthIncome - monthExpense)

  const debtorRows = React.useMemo(() => buildDebtorRows({
    accounts,
    credits: filteredCredits,
    collections: filteredCollections,
    todayKey
  }), [accounts, filteredCollections, filteredCredits, todayKey])
  const riskyCurrentCount = debtorRows.filter(isRiskyDebtor).length
  const totalRiskAmount = roundMoney(openCreditAmount + openSupplierDebtAmount)

  const topIncomeItems = [
    ...filteredIncomeRecords.map(toIncomeItem),
    ...filteredCashIncome.map(toCashItem)
  ].sort((first, second) => second.amount - first.amount).slice(0, 5)
  const topExpenseItems = [
    ...filteredExpenseRecords.map(toIncomeItem),
    ...filteredCashExpense.map(toCashItem)
  ].sort((first, second) => second.amount - first.amount).slice(0, 5)
  const topDebtors = debtorRows.slice(0, 5)
  const topSupplierDebts: SupplierDebtRow[] = filteredSupplierDebts
    .filter(debt => debt.remainingAmount > 0)
    .map(debt => ({
      debt,
      supplierName: getAccountName(accountMap, debt.currentAccountId),
      amount: debt.amount,
      remainingAmount: debt.remainingAmount
    }))
    .sort((first, second) => second.remainingAmount - first.remainingAmount)
    .slice(0, 5)

  return (
    <div className="financial-reports-page">
      <div className="page-title">
        <div>
          <h2>Finans Raporları</h2>
          <p className="muted">İşletmenin genel finansal performansını inceleyin.</p>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{range.label} verileri gösteriliyor.</p>
          </div>
          <div className="toolbar-controls financial-report-filters">
            <select value={rangeMode} onChange={event => setRangeMode(event.target.value as DateRangeMode)}>
              <option value="month">Bu Ay</option>
              <option value="year">Bu Yıl</option>
              <option value="all">Tümü</option>
              <option value="custom">Özel Tarih</option>
            </select>
            <input
              type="date"
              value={customStartDate}
              onChange={event => setCustomStartDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
            <input
              type="date"
              value={customEndDate}
              onChange={event => setCustomEndDate(event.target.value)}
              disabled={rangeMode !== 'custom'}
            />
          </div>
        </div>
      </section>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Gelir</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="metric-card">
          <span>Toplam Gider</span>
          <strong>{formatCurrency(totalExpense)}</strong>
        </div>
        <div className="metric-card">
          <span>Net Kâr/Zarar</span>
          <strong>{formatCurrency(netProfit)}</strong>
        </div>
        <div className="metric-card">
          <span>Kasadaki Para</span>
          <strong>{formatCurrency(cashBalance)}</strong>
          <p className="muted">{filteredClosings.length > 0 ? 'Son kapanış fiili kasası' : 'Kasa hareketlerinden hesaplandı'}</p>
        </div>
      </div>

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Toplam Tahsilat</span>
          <strong>{formatCurrency(totalCollection)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Veresiye</span>
          <strong>{formatCurrency(totalCredit)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Tedarikçi Borcu</span>
          <strong>{formatCurrency(totalSupplierDebt)}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Tedarikçi Ödemesi</span>
          <strong>{formatCurrency(totalSupplierPayment)}</strong>
        </div>
      </div>

      <section className="financial-summary-grid">
        <section className="card financial-summary-card">
          <div className="section-header compact">
            <h3>Finans Özeti</h3>
          </div>
          <div className="financial-summary-values">
            <div>
              <span>Bu Ay Gelir</span>
              <strong>{formatCurrency(monthIncome)}</strong>
            </div>
            <div>
              <span>Bu Ay Gider</span>
              <strong>{formatCurrency(monthExpense)}</strong>
            </div>
            <div>
              <span>Bu Ay Net Sonuç</span>
              <strong>{formatCurrency(monthNet)}</strong>
            </div>
          </div>
        </section>

        <section className="card financial-summary-card">
          <div className="section-header compact">
            <h3>Finansal Risk Özeti</h3>
          </div>
          <div className="financial-summary-values">
            <div>
              <span>Açık Veresiye</span>
              <strong>{formatCurrency(openCreditAmount)}</strong>
            </div>
            <div>
              <span>Riskli Cari Sayısı</span>
              <strong>{riskyCurrentCount}</strong>
            </div>
            <div>
              <span>Açık Tedarikçi Borcu</span>
              <strong>{formatCurrency(openSupplierDebtAmount)}</strong>
            </div>
            <div>
              <span>Toplam Risk Tutarı</span>
              <strong>{formatCurrency(totalRiskAmount)}</strong>
            </div>
          </div>
        </section>
      </section>

      <section className="financial-report-list-grid">
        <FinancialLineCard
          title="En Büyük 5 Gelir"
          rows={topIncomeItems}
          emptyText="Bu filtrede gelir kalemi bulunamadı."
        />
        <FinancialLineCard
          title="En Büyük 5 Gider"
          rows={topExpenseItems}
          emptyText="Bu filtrede gider kalemi bulunamadı."
        />
        <DebtorCard rows={topDebtors} />
        <SupplierDebtCard rows={topSupplierDebts} />
      </section>
    </div>
  )
}

function FinancialLineCard({
  title,
  rows,
  emptyText
}: {
  title: string
  rows: ReportLineItem[]
  emptyText: string
}){
  return (
    <section className="card current-report-list-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="current-report-mini-list">
        {rows.length === 0 && <p className="muted">{emptyText}</p>}
        {rows.map(row => (
          <div className="current-report-mini-row" key={`${title}_${row.id}`}>
            <div>
              <strong>{row.title}</strong>
              <span>{row.subtitle} · {row.date}</span>
            </div>
            <div>
              <span>Tutar</span>
              <strong>{formatCurrency(row.amount)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function DebtorCard({ rows }: { rows: DebtorRow[] }){
  return (
    <section className="card current-report-list-card">
      <div className="section-header compact">
        <h3>En Borçlu 5 Cari</h3>
      </div>
      <div className="current-report-mini-list">
        {rows.length === 0 && <p className="muted">Borçlu cari bulunamadı.</p>}
        {rows.map(row => (
          <div className="current-report-mini-row" key={`debtor_${row.account.id}`}>
            <div>
              <strong>{row.account.name}</strong>
              <span>{row.account.code} · {row.account.type}</span>
            </div>
            <div>
              <span>Net Bakiye</span>
              <strong>{formatCurrency(row.netBalance)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SupplierDebtCard({ rows }: { rows: SupplierDebtRow[] }){
  return (
    <section className="card current-report-list-card">
      <div className="section-header compact">
        <h3>En Büyük 5 Tedarikçi Borcu</h3>
      </div>
      <div className="current-report-mini-list">
        {rows.length === 0 && <p className="muted">Açık tedarikçi borcu bulunamadı.</p>}
        {rows.map(row => (
          <div className="current-report-mini-row" key={`supplier_debt_${row.debt.id}`}>
            <div>
              <strong>{row.supplierName}</strong>
              <span>{row.debt.invoiceNumber || row.debt.id} · {row.debt.date}</span>
            </div>
            <div>
              <span>Kalan</span>
              <strong>{formatCurrency(row.remainingAmount)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
