import React from 'react'
import { formatCurrency, roundCurrency } from '../../billing'
import type { CriticalStockReportResult, CriticalStockReportRow } from './CriticalStockReport'
import type { ExpiredProductsReportResult } from './ExpiredProductsReport'
import type { ExpiringProductsReportResult } from './ExpiringProductsReport'
import type { LowSellingProductsReportResult } from './LowSellingProductsReport'
import type { ProductProfitabilityReportResult } from './ProductProfitabilityReport'
import type { ReportKpi } from './ReportKpis'
import type { ReportTabId } from './ReportTabs'
import type { SalesRevenuePeriodSummary, SalesRevenueReportResult } from './SalesRevenueReport'
import type { StockTurnoverReportResult } from './StockTurnoverReport'
import type { TopSellingProductsReportResult } from './TopSellingProductsReport'
import type { WasteCostReportResult } from './WasteCostReport'

type ExecutiveSummaryCard = {
  label: string
  value: string
  detail: string
}

type ExecutiveAlert = {
  id: string
  type: string
  title: string
  detail: string
  meta: string
  statusClassName: string
  severity: number
}

export type ExecutiveDashboardReportResult = {
  kpis: ReportKpi[]
  summaryCards: ExecutiveSummaryCard[]
  financeSummary: ExecutiveSummaryCard[]
  salesSummary: SalesRevenuePeriodSummary[]
  alerts: ExecutiveAlert[]
}

type UseExecutiveDashboardReportArgs = {
  salesRevenueReport: SalesRevenueReportResult
  productProfitabilityReport: ProductProfitabilityReportResult
  criticalStockReport: CriticalStockReportResult
  expiringProductsReport: ExpiringProductsReportResult
  expiredProductsReport: ExpiredProductsReportResult
  wasteCostReport: WasteCostReportResult
  stockTurnoverReport: StockTurnoverReportResult
  topSellingProductsReport: TopSellingProductsReportResult
  lowSellingProductsReport: LowSellingProductsReportResult
}

type ExecutiveDashboardReportProps = {
  report: ExecutiveDashboardReportResult
  onOpenReport: (tab: ReportTabId) => void
}

const quickLinks: Array<{ label: string; tab: ReportTabId }> = [
  { label: 'Satış ve Ciro', tab: 'sales-revenue' },
  { label: 'Ürün Karlılık', tab: 'product-profitability' },
  { label: 'Kritik Stok', tab: 'critical-stock' },
  { label: 'Fire ve Kayıp', tab: 'waste-cost' },
  { label: 'SKT Yaklaşan', tab: 'expiry-near' },
  { label: 'SKT Geçmiş', tab: 'expiry-expired' }
]

const formatNumber = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}

const formatQty = (value: number) => {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

const formatPercent = (value: number) => {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const formatRate = (value: number) => {
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`
}

const getDateKey = (value?: string | Date) => {
  if(!value) return ''

  const date = typeof value === 'string' ? new Date(value) : value
  if(Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('sv-SE')
}

const getCurrentMonthKey = () => getDateKey(new Date()).slice(0, 7)

const sumBy = <T,>(items: T[], getValue: (item: T) => number) => {
  return roundCurrency(items.reduce((sum, item) => sum + getValue(item), 0))
}

const getMaxBy = <T,>(items: T[], getValue: (item: T) => number) => {
  return [...items].sort((first, second) => getValue(second) - getValue(first))[0]
}

const getMinBy = <T,>(items: T[], getValue: (item: T) => number) => {
  return [...items].sort((first, second) => getValue(first) - getValue(second))[0]
}

const getPeriodSummary = (summaries: SalesRevenuePeriodSummary[], label: string): SalesRevenuePeriodSummary => {
  return summaries.find(summary => summary.label === label) || { label, salesQty: 0, revenue: 0 }
}

const getCriticalSeverity = (row: CriticalStockReportRow) => {
  if(row.status === 'out') return 4
  if(row.status === 'very-critical') return 3
  return 2
}

const buildWasteLeader = (wasteCostReport: WasteCostReportResult) => {
  type WasteBucket = {
    stockName: string
    qty: number
    unit: string
    totalCost: number
  }

  const buckets = wasteCostReport.rows.reduce<Map<string, WasteBucket>>((acc, row) => {
    const key = `${row.stockItemId}_${row.unit}`
    const current = acc.get(key)

    acc.set(key, {
      stockName: row.stockName,
      qty: (current?.qty || 0) + row.qty,
      unit: row.unit,
      totalCost: roundCurrency((current?.totalCost || 0) + row.totalCost)
    })
    return acc
  }, new Map())

  return getMaxBy([...buckets.values()], bucket => bucket.qty)
}

const buildAlerts = ({
  criticalStockReport,
  expiringProductsReport,
  expiredProductsReport,
  stockTurnoverReport
}: Pick<UseExecutiveDashboardReportArgs, 'criticalStockReport' | 'expiringProductsReport' | 'expiredProductsReport' | 'stockTurnoverReport'>): ExecutiveAlert[] => {
  const criticalAlerts: ExecutiveAlert[] = criticalStockReport.rows.map(row => ({
    id: `critical-${row.stockItemId}`,
    type: 'Kritik Stok',
    title: row.stockName,
    detail: `${formatQty(row.currentQty)} / ${formatQty(row.minQty)} ${row.unit}`,
    meta: row.statusLabel,
    statusClassName: row.statusClassName,
    severity: getCriticalSeverity(row)
  }))

  const expiringAlerts: ExecutiveAlert[] = expiringProductsReport.rows.map(row => ({
    id: `expiring-${row.lotId}`,
    type: 'SKT Yaklaşıyor',
    title: row.stockName,
    detail: `${row.lotCode} · ${row.expiryDateLabel}`,
    meta: `${formatNumber(row.daysLeft)} gün`,
    statusClassName: row.statusClassName,
    severity: row.status === 'urgent' ? 3.5 : row.status === 'approaching' ? 2.5 : 1.5
  }))

  const expiredAlerts: ExecutiveAlert[] = expiredProductsReport.rows.map(row => ({
    id: `expired-${row.lotId}`,
    type: 'SKT Geçmiş',
    title: row.stockName,
    detail: `${row.lotCode} · ${row.expiryDateLabel}`,
    meta: `${formatNumber(row.daysPast)} gün geçmiş`,
    statusClassName: row.statusClassName,
    severity: row.status === 'dispose' ? 4 : row.status === 'critical' ? 3.5 : 3
  }))

  const slowTurnoverAlerts: ExecutiveAlert[] = stockTurnoverReport.rows
    .filter(row => row.status === 'slow')
    .map(row => ({
      id: `slow-${row.stockItemId}`,
      type: 'Yavaş Devir',
      title: row.stockName,
      detail: `Devir ${formatRate(row.turnoverRate)} · ${formatQty(row.consumedQty)} ${row.unit}`,
      meta: row.statusLabel,
      statusClassName: row.statusClassName,
      severity: 1
    }))

  return [...expiredAlerts, ...criticalAlerts, ...expiringAlerts, ...slowTurnoverAlerts]
    .sort((first, second) => second.severity - first.severity || first.title.localeCompare(second.title, 'tr-TR'))
    .slice(0, 10)
}

export const useExecutiveDashboardReport = ({
  salesRevenueReport,
  productProfitabilityReport,
  criticalStockReport,
  expiringProductsReport,
  expiredProductsReport,
  wasteCostReport,
  stockTurnoverReport,
  topSellingProductsReport,
  lowSellingProductsReport
}: UseExecutiveDashboardReportArgs): ExecutiveDashboardReportResult => {
  return React.useMemo(() => {
    const todayKey = getDateKey(new Date())
    const monthKey = getCurrentMonthKey()
    const todayRevenue = sumBy(
      salesRevenueReport.rows.filter(row => row.dateKey === todayKey),
      row => row.netTotal
    )
    const monthRevenue = sumBy(
      salesRevenueReport.rows.filter(row => row.dateKey.startsWith(monthKey)),
      row => row.netTotal
    )
    const salesRevenueTotal = sumBy(salesRevenueReport.rows, row => row.netTotal)
    const profitabilityRevenue = sumBy(productProfitabilityReport.rows, row => row.salesRevenue)
    const totalRevenue = profitabilityRevenue > 0 ? profitabilityRevenue : salesRevenueTotal
    const totalCost = sumBy(productProfitabilityReport.rows, row => row.totalCost)
    const totalGrossProfit = sumBy(productProfitabilityReport.rows, row => row.grossProfit)
    const profitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0
    const expiringProductIds = new Set(expiringProductsReport.rows.map(row => row.stockItemId))
    const expiredProductIds = new Set(expiredProductsReport.rows.map(row => row.stockItemId))
    const expiryRiskProductCount = new Set([...expiringProductIds, ...expiredProductIds]).size
    const totalWasteCost = sumBy(wasteCostReport.rows, row => row.totalCost)

    const topSelling = getMaxBy(topSellingProductsReport.rows, row => row.salesQty)
    const mostProfitable = getMaxBy(productProfitabilityReport.rows, row => row.grossProfit)
    const lowestSelling = getMinBy(lowSellingProductsReport.rows, row => row.salesQty)
    const wasteLeader = buildWasteLeader(wasteCostReport)
    const fastestTurnover = getMaxBy(stockTurnoverReport.rows, row => row.turnoverRate)
    const slowestTurnover = getMinBy(stockTurnoverReport.rows, row => row.turnoverRate)

    return {
      kpis: [
        { label: 'Bugünkü Ciro', value: formatCurrency(todayRevenue), detail: 'Bugün tamamlanan adisyonlar' },
        { label: 'Bu Ayki Ciro', value: formatCurrency(monthRevenue), detail: 'Ay içindeki tamamlanan adisyonlar' },
        { label: 'Toplam Brüt Kar', value: formatCurrency(totalGrossProfit), detail: `Kar marjı ${formatPercent(profitMargin)}` },
        { label: 'Kritik Stok Sayısı', value: formatNumber(criticalStockReport.rows.length), detail: 'Kritik, çok kritik ve stok yok' },
        {
          label: 'SKT Riski Olan Ürün Sayısı',
          value: formatNumber(expiryRiskProductCount),
          detail: `${formatNumber(expiringProductsReport.rows.length)} yaklaşan lot · ${formatNumber(expiredProductsReport.rows.length)} geçmiş lot`
        },
        { label: 'Toplam Fire Maliyeti', value: formatCurrency(totalWasteCost), detail: `${formatNumber(wasteCostReport.rows.length)} fire kaydı` }
      ],
      summaryCards: [
        {
          label: 'En Çok Satan Ürün',
          value: topSelling?.productName || '-',
          detail: topSelling ? `${formatQty(topSelling.salesQty)} adet · ${formatCurrency(topSelling.totalRevenue)}` : 'Satış kaydı yok'
        },
        {
          label: 'En Karlı Ürün',
          value: mostProfitable?.productName || '-',
          detail: mostProfitable ? `${formatCurrency(mostProfitable.grossProfit)} brüt kar · ${formatPercent(mostProfitable.profitMargin)}` : 'Kârlılık verisi yok'
        },
        {
          label: 'En Az Satan Ürün',
          value: lowestSelling?.productName || '-',
          detail: lowestSelling ? `${formatQty(lowestSelling.salesQty)} adet · ${lowestSelling.statusLabel}` : 'Ürün verisi yok'
        },
        {
          label: 'En Yüksek Fire Veren Ürün',
          value: wasteLeader?.stockName || '-',
          detail: wasteLeader ? `${formatQty(wasteLeader.qty)} ${wasteLeader.unit} · ${formatCurrency(wasteLeader.totalCost)}` : 'Fire kaydı yok'
        },
        {
          label: 'En Hızlı Dönen Stok',
          value: fastestTurnover?.stockName || '-',
          detail: fastestTurnover ? `${formatRate(fastestTurnover.turnoverRate)} · ${formatCurrency(fastestTurnover.consumptionCost)}` : 'Tüketim verisi yok'
        },
        {
          label: 'En Yavaş Dönen Stok',
          value: slowestTurnover?.stockName || '-',
          detail: slowestTurnover ? `${formatRate(slowestTurnover.turnoverRate)} · ${slowestTurnover.statusLabel}` : 'Tüketim verisi yok'
        }
      ],
      financeSummary: [
        { label: 'Toplam Ciro', value: formatCurrency(totalRevenue), detail: 'Ürün satış gelirleri' },
        { label: 'Toplam Maliyet', value: formatCurrency(totalCost), detail: 'Reçete maliyetleri' },
        { label: 'Toplam Kar', value: formatCurrency(totalGrossProfit), detail: 'Ciro - maliyet' },
        { label: 'Kar Marjı %', value: formatPercent(profitMargin), detail: 'Toplam kar / toplam ciro' }
      ],
      salesSummary: [
        getPeriodSummary(salesRevenueReport.periodSummaries, 'Bugün'),
        getPeriodSummary(salesRevenueReport.periodSummaries, 'Bu Hafta'),
        getPeriodSummary(salesRevenueReport.periodSummaries, 'Bu Ay')
      ],
      alerts: buildAlerts({
        criticalStockReport,
        expiringProductsReport,
        expiredProductsReport,
        stockTurnoverReport
      })
    }
  }, [
    salesRevenueReport,
    productProfitabilityReport,
    criticalStockReport,
    expiringProductsReport,
    expiredProductsReport,
    wasteCostReport,
    stockTurnoverReport,
    topSellingProductsReport,
    lowSellingProductsReport
  ])
}

const SummaryPanel = ({ item }: { item: ExecutiveSummaryCard }) => (
  <div className="executive-summary-card">
    <span>{item.label}</span>
    <strong>{item.value}</strong>
    <p className="muted">{item.detail}</p>
  </div>
)

export default function ExecutiveDashboardReport({ report, onOpenReport }: ExecutiveDashboardReportProps){
  return (
    <section className="card report-center-card executive-dashboard-report">
      <div className="section-header compact">
        <div>
          <h3>Yönetici Özeti Dashboard</h3>
          <p className="muted">Ciro, kârlılık, stok riski, SKT ve fire durumunu tek ekranda özetler.</p>
        </div>
        <span className="status-pill success">Gerçek Veri</span>
      </div>

      <div className="report-panel-grid three executive-summary-grid">
        {report.summaryCards.map(item => <SummaryPanel key={item.label} item={item} />)}
      </div>

      <div className="executive-dashboard-grid">
        <div className="report-panel executive-alert-panel">
          <div className="section-header compact">
            <div>
              <h4>Uyarı Paneli</h4>
              <p className="muted">Kritik stok, SKT ve yavaş devir risklerinden en öncelikli 10 kayıt.</p>
            </div>
            <span className="status-pill">{formatNumber(report.alerts.length)} kayıt</span>
          </div>

          <div className="executive-alert-list">
            {report.alerts.length === 0 && (
              <div className="empty-cell executive-empty-alert">Aktif kritik uyarı bulunmuyor.</div>
            )}
            {report.alerts.map(alert => (
              <div className="executive-alert-row" key={alert.id}>
                <div>
                  <span>{alert.type}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.detail}</small>
                </div>
                <span className={`status-pill ${alert.statusClassName}`}>{alert.meta}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="executive-side-stack">
          <div className="report-panel">
            <h4>Finans Özeti</h4>
            <div className="executive-mini-grid">
              {report.financeSummary.map(item => <SummaryPanel key={item.label} item={item} />)}
            </div>
          </div>

          <div className="report-panel">
            <h4>Satış Özeti</h4>
            <div className="executive-sales-list">
              {report.salesSummary.map(summary => (
                <div className="sales-period-values" key={summary.label}>
                  <span>{summary.label}</span>
                  <strong>{formatQty(summary.salesQty)} adet · {formatCurrency(summary.revenue)}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="report-panel">
            <h4>Hızlı Geçişler</h4>
            <div className="executive-quick-links">
              {quickLinks.map(link => (
                <button className="btn" type="button" key={link.tab} onClick={() => onOpenReport(link.tab)}>
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
