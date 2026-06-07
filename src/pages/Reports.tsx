import React from 'react'
import CriticalStockReport, {
  CriticalStockSortDirection,
  CriticalStockSortKey,
  exportCriticalStockReportCsv,
  useCriticalStockReport
} from '../components/reports/CriticalStockReport'
import ExpiringProductsReport, {
  ExpiringProductsSortDirection,
  ExpiringProductsSortKey,
  exportExpiringProductsReportCsv,
  useExpiringProductsReport
} from '../components/reports/ExpiringProductsReport'
import ExpiredProductsReport, {
  ExpiredProductsSortDirection,
  ExpiredProductsSortKey,
  exportExpiredProductsReportCsv,
  useExpiredProductsReport
} from '../components/reports/ExpiredProductsReport'
import ReportFilters, { defaultReportFilters, ReportFiltersValue } from '../components/reports/ReportFilters'
import ReportKpis, { ReportKpi } from '../components/reports/ReportKpis'
import ReportPlaceholder from '../components/reports/ReportPlaceholder'
import ReportTabs, { ReportTabId } from '../components/reports/ReportTabs'
import StockMovementsReport, {
  exportStockMovementsReportCsv,
  StockMovementsSortDirection,
  StockMovementsSortKey,
  useStockMovementsReport
} from '../components/reports/StockMovementsReport'
import StockStatusReport, {
  exportStockStatusReportCsv,
  StockStatusSortDirection,
  StockStatusSortKey,
  useStockStatusReport
} from '../components/reports/StockStatusReport'
import { loadCriticalStockEvents, loadStockCategories, loadStockExpiryLots, loadStockItems, loadStockMovements, loadUsers } from '../storage'

const placeholderKpis: ReportKpi[] = [
  { label: 'Toplam Stok Değeri', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Kritik Ürün Sayısı', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'SKT Riski', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Fire Maliyeti', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Fire Veren Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Tüketilen Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' }
]

const isRealReport = (activeTab: ReportTabId) => {
  return activeTab === 'stock-status'
    || activeTab === 'stock-movements'
    || activeTab === 'critical-stock'
    || activeTab === 'expiry-near'
    || activeTab === 'expiry-expired'
}

export default function Reports(){
  const [activeTab, setActiveTab] = React.useState<ReportTabId>('stock-status')
  const [filters, setFilters] = React.useState<ReportFiltersValue>(defaultReportFilters)
  const [stockStatusSortKey, setStockStatusSortKey] = React.useState<StockStatusSortKey>('name')
  const [stockStatusSortDirection, setStockStatusSortDirection] = React.useState<StockStatusSortDirection>('asc')
  const [stockMovementsSortKey, setStockMovementsSortKey] = React.useState<StockMovementsSortKey>('date')
  const [stockMovementsSortDirection, setStockMovementsSortDirection] = React.useState<StockMovementsSortDirection>('desc')
  const [criticalStockSortKey, setCriticalStockSortKey] = React.useState<CriticalStockSortKey>('shortage')
  const [criticalStockSortDirection, setCriticalStockSortDirection] = React.useState<CriticalStockSortDirection>('desc')
  const [expiringProductsSortKey, setExpiringProductsSortKey] = React.useState<ExpiringProductsSortKey>('expiryDate')
  const [expiringProductsSortDirection, setExpiringProductsSortDirection] = React.useState<ExpiringProductsSortDirection>('asc')
  const [expiredProductsSortKey, setExpiredProductsSortKey] = React.useState<ExpiredProductsSortKey>('expiryDate')
  const [expiredProductsSortDirection, setExpiredProductsSortDirection] = React.useState<ExpiredProductsSortDirection>('asc')
  const [categories] = React.useState(() => loadStockCategories())
  const [stockItems] = React.useState(() => loadStockItems())
  const [stockMovements] = React.useState(() => loadStockMovements())
  const [stockExpiryLots] = React.useState(() => loadStockExpiryLots())
  const [criticalStockEvents] = React.useState(() => loadCriticalStockEvents())
  const [users] = React.useState(() => loadUsers())
  const stockStatusReport = useStockStatusReport({
    stockItems,
    categories,
    movements: stockMovements,
    expiryLots: stockExpiryLots,
    filters,
    sortKey: stockStatusSortKey,
    sortDirection: stockStatusSortDirection
  })
  const stockMovementsReport = useStockMovementsReport({
    movements: stockMovements,
    stockItems,
    filters,
    sortKey: stockMovementsSortKey,
    sortDirection: stockMovementsSortDirection
  })
  const criticalStockReport = useCriticalStockReport({
    stockItems,
    categories,
    movements: stockMovements,
    criticalEvents: criticalStockEvents,
    filters,
    sortKey: criticalStockSortKey,
    sortDirection: criticalStockSortDirection
  })
  const expiringProductsReport = useExpiringProductsReport({
    stockItems,
    categories,
    expiryLots: stockExpiryLots,
    filters,
    sortKey: expiringProductsSortKey,
    sortDirection: expiringProductsSortDirection
  })
  const expiredProductsReport = useExpiredProductsReport({
    stockItems,
    categories,
    expiryLots: stockExpiryLots,
    filters,
    sortKey: expiredProductsSortKey,
    sortDirection: expiredProductsSortDirection
  })
  const activeKpis = activeTab === 'stock-status'
    ? stockStatusReport.kpis
    : activeTab === 'stock-movements'
      ? stockMovementsReport.kpis
      : activeTab === 'critical-stock'
        ? criticalStockReport.kpis
        : activeTab === 'expiry-near'
          ? expiringProductsReport.kpis
          : activeTab === 'expiry-expired'
            ? expiredProductsReport.kpis
            : placeholderKpis

  const exportCsv = () => {
    if(activeTab === 'stock-status'){
      exportStockStatusReportCsv({
        report: stockStatusReport,
        filters,
        categories,
        stockItems
      })
      return
    }

    if(activeTab === 'stock-movements'){
      exportStockMovementsReportCsv({
        report: stockMovementsReport,
        filters,
        categories,
        stockItems,
        users,
        sortKey: stockMovementsSortKey,
        sortDirection: stockMovementsSortDirection
      })
      return
    }

    if(activeTab === 'critical-stock'){
      exportCriticalStockReportCsv({
        report: criticalStockReport,
        filters,
        categories,
        stockItems,
        sortKey: criticalStockSortKey,
        sortDirection: criticalStockSortDirection
      })
      return
    }

    if(activeTab === 'expiry-near'){
      exportExpiringProductsReportCsv({
        report: expiringProductsReport,
        filters,
        categories,
        stockItems,
        sortKey: expiringProductsSortKey,
        sortDirection: expiringProductsSortDirection
      })
      return
    }

    if(activeTab === 'expiry-expired'){
      exportExpiredProductsReportCsv({
        report: expiredProductsReport,
        filters,
        categories,
        stockItems,
        sortKey: expiredProductsSortKey,
        sortDirection: expiredProductsSortDirection
      })
    }
  }

  const usesCompactReportFilters = activeTab === 'critical-stock' || activeTab === 'expiry-near' || activeTab === 'expiry-expired'

  return (
    <div className="reports-page">
      <div className="page-title">
        <div>
          <h2>Raporlama</h2>
          <p className="muted">Stok, SKT, lot, reçete ve fire verileri için merkezi rapor altyapısı.</p>
        </div>
        <div className="report-export-actions">
          <button className="btn" type="button" onClick={exportCsv} disabled={!isRealReport(activeTab)}>CSV Dışa Aktar</button>
          <button className="btn" type="button" disabled>PDF Dışa Aktar</button>
        </div>
      </div>

      <ReportKpis items={activeKpis} />

      <section className="card report-center-card">
        <div className="section-header compact">
          <div>
            <h3>Rapor Türleri</h3>
            <p className="muted">Her rapor türü ortak filtre altyapısını kullanacaktır.</p>
          </div>
          <span className="status-pill">Altyapı</span>
        </div>
        <ReportTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      <ReportFilters
        filters={filters}
        categories={categories}
        stockItems={stockItems}
        users={users}
        onChange={setFilters}
        showMovementTypeFilter={activeTab === 'stock-movements'}
        showCriticalStatusFilter={activeTab === 'critical-stock'}
        showExpiryStatusFilter={activeTab === 'expiry-near'}
        showExpiredStatusFilter={activeTab === 'expiry-expired'}
        showDateFilters={!usesCompactReportFilters}
        showPersonnelFilter={!usesCompactReportFilters}
      />

      {activeTab === 'stock-status' ? (
        <StockStatusReport
          report={stockStatusReport}
          sortKey={stockStatusSortKey}
          sortDirection={stockStatusSortDirection}
          onSortKeyChange={setStockStatusSortKey}
          onSortDirectionChange={setStockStatusSortDirection}
        />
      ) : activeTab === 'stock-movements' ? (
        <StockMovementsReport
          report={stockMovementsReport}
          sortKey={stockMovementsSortKey}
          sortDirection={stockMovementsSortDirection}
          onSortKeyChange={setStockMovementsSortKey}
          onSortDirectionChange={setStockMovementsSortDirection}
        />
      ) : activeTab === 'critical-stock' ? (
        <CriticalStockReport
          report={criticalStockReport}
          sortKey={criticalStockSortKey}
          sortDirection={criticalStockSortDirection}
          onSortKeyChange={setCriticalStockSortKey}
          onSortDirectionChange={setCriticalStockSortDirection}
        />
      ) : activeTab === 'expiry-near' ? (
        <ExpiringProductsReport
          report={expiringProductsReport}
          sortKey={expiringProductsSortKey}
          sortDirection={expiringProductsSortDirection}
          onSortKeyChange={setExpiringProductsSortKey}
          onSortDirectionChange={setExpiringProductsSortDirection}
        />
      ) : activeTab === 'expiry-expired' ? (
        <ExpiredProductsReport
          report={expiredProductsReport}
          sortKey={expiredProductsSortKey}
          sortDirection={expiredProductsSortDirection}
          onSortKeyChange={setExpiredProductsSortKey}
          onSortDirectionChange={setExpiredProductsSortDirection}
        />
      ) : (
        <ReportPlaceholder activeTab={activeTab} />
      )}
    </div>
  )
}
