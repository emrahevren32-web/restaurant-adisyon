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
import ExecutiveDashboardReport, {
  useExecutiveDashboardReport
} from '../components/reports/ExecutiveDashboardReport'
import ReportFilters, { defaultReportFilters, ReportFiltersValue } from '../components/reports/ReportFilters'
import ReportKpis, { ReportKpi } from '../components/reports/ReportKpis'
import ReportPlaceholder from '../components/reports/ReportPlaceholder'
import ReportTabs, { ReportTabId } from '../components/reports/ReportTabs'
import LowSellingProductsReport, {
  exportLowSellingProductsReportCsv,
  LowSellingProductsSortDirection,
  LowSellingProductsSortKey,
  useLowSellingProductsReport
} from '../components/reports/LowSellingProductsReport'
import ProductProfitabilityReport, {
  exportProductProfitabilityReportCsv,
  ProductProfitabilitySortDirection,
  ProductProfitabilitySortKey,
  useProductProfitabilityReport
} from '../components/reports/ProductProfitabilityReport'
import RecipeConsumptionReport, {
  exportRecipeConsumptionReportCsv,
  RecipeConsumptionSortDirection,
  RecipeConsumptionSortKey,
  useRecipeConsumptionReport
} from '../components/reports/RecipeConsumptionReport'
import SalesRevenueReport, {
  exportSalesRevenueReportCsv,
  SalesRevenueSortDirection,
  SalesRevenueSortKey,
  useSalesRevenueReport
} from '../components/reports/SalesRevenueReport'
import SalesTrendReport, {
  exportSalesTrendReportCsv,
  SalesTrendSortDirection,
  SalesTrendSortKey,
  useSalesTrendReport
} from '../components/reports/SalesTrendReport'
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
import StockTurnoverReport, {
  exportStockTurnoverReportCsv,
  StockTurnoverSortDirection,
  StockTurnoverSortKey,
  useStockTurnoverReport
} from '../components/reports/StockTurnoverReport'
import TopSellingProductsReport, {
  exportTopSellingProductsReportCsv,
  TopSellingProductsSortDirection,
  TopSellingProductsSortKey,
  useTopSellingProductsReport
} from '../components/reports/TopSellingProductsReport'
import WasteCostReport, {
  exportWasteCostReportCsv,
  useWasteCostReport,
  WasteCostSortDirection,
  WasteCostSortKey
} from '../components/reports/WasteCostReport'
import { loadCategories, loadClosed, loadCriticalStockEvents, loadProducts, loadRecipes, loadStockCategories, loadStockDeductionBatches, loadStockExpiryLots, loadStockItems, loadStockMovements, loadStockWasteRecords, loadTables, loadUsers } from '../storage'

const placeholderKpis: ReportKpi[] = [
  { label: 'Toplam Stok Değeri', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Kritik Ürün Sayısı', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'SKT Riski', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Fire Maliyeti', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Fire Veren Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Tüketilen Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' }
]

const isRealReport = (activeTab: ReportTabId) => {
  return activeTab === 'executive-dashboard'
    || activeTab === 'stock-status'
    || activeTab === 'stock-movements'
    || activeTab === 'critical-stock'
    || activeTab === 'expiry-near'
    || activeTab === 'expiry-expired'
    || activeTab === 'waste-cost'
    || activeTab === 'recipe-consumption'
    || activeTab === 'product-profitability'
    || activeTab === 'sales-revenue'
    || activeTab === 'stock-turnover'
    || activeTab === 'top-selling-products'
    || activeTab === 'low-selling-products'
    || activeTab === 'sales-trend'
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
  const [wasteCostSortKey, setWasteCostSortKey] = React.useState<WasteCostSortKey>('totalCost')
  const [wasteCostSortDirection, setWasteCostSortDirection] = React.useState<WasteCostSortDirection>('desc')
  const [recipeConsumptionSortKey, setRecipeConsumptionSortKey] = React.useState<RecipeConsumptionSortKey>('totalCost')
  const [recipeConsumptionSortDirection, setRecipeConsumptionSortDirection] = React.useState<RecipeConsumptionSortDirection>('desc')
  const [productProfitabilitySortKey, setProductProfitabilitySortKey] = React.useState<ProductProfitabilitySortKey>('grossProfit')
  const [productProfitabilitySortDirection, setProductProfitabilitySortDirection] = React.useState<ProductProfitabilitySortDirection>('desc')
  const [salesRevenueSortKey, setSalesRevenueSortKey] = React.useState<SalesRevenueSortKey>('netTotal')
  const [salesRevenueSortDirection, setSalesRevenueSortDirection] = React.useState<SalesRevenueSortDirection>('desc')
  const [salesTrendSortKey, setSalesTrendSortKey] = React.useState<SalesTrendSortKey>('revenue')
  const [salesTrendSortDirection, setSalesTrendSortDirection] = React.useState<SalesTrendSortDirection>('desc')
  const [stockTurnoverSortKey, setStockTurnoverSortKey] = React.useState<StockTurnoverSortKey>('turnoverRate')
  const [stockTurnoverSortDirection, setStockTurnoverSortDirection] = React.useState<StockTurnoverSortDirection>('asc')
  const [topSellingProductsSortKey, setTopSellingProductsSortKey] = React.useState<TopSellingProductsSortKey>('salesQty')
  const [topSellingProductsSortDirection, setTopSellingProductsSortDirection] = React.useState<TopSellingProductsSortDirection>('desc')
  const [lowSellingProductsSortKey, setLowSellingProductsSortKey] = React.useState<LowSellingProductsSortKey>('salesQty')
  const [lowSellingProductsSortDirection, setLowSellingProductsSortDirection] = React.useState<LowSellingProductsSortDirection>('asc')
  const [productCategories] = React.useState(() => loadCategories())
  const [products] = React.useState(() => loadProducts())
  const [closedBills] = React.useState(() => loadClosed())
  const [recipes] = React.useState(() => loadRecipes())
  const [tables] = React.useState(() => loadTables())
  const [categories] = React.useState(() => loadStockCategories())
  const [stockItems] = React.useState(() => loadStockItems())
  const [stockMovements] = React.useState(() => loadStockMovements())
  const [stockExpiryLots] = React.useState(() => loadStockExpiryLots())
  const [stockWasteRecords] = React.useState(() => loadStockWasteRecords())
  const [stockDeductionBatches] = React.useState(() => loadStockDeductionBatches())
  const [criticalStockEvents] = React.useState(() => loadCriticalStockEvents())
  const [users] = React.useState(() => loadUsers())
  const reportTables = React.useMemo(() => {
    const tableMap = new Map(tables.map(table => [table.id, { id: table.id, name: table.name }]))
    closedBills.forEach(bill => {
      if(!tableMap.has(bill.tableId)){
        tableMap.set(bill.tableId, { id: bill.tableId, name: bill.tableName || bill.tableId })
      }
    })
    return [...tableMap.values()].sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
  }, [tables, closedBills])
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
  const wasteCostReport = useWasteCostReport({
    wasteRecords: stockWasteRecords,
    movements: stockMovements,
    stockItems,
    categories,
    filters,
    sortKey: wasteCostSortKey,
    sortDirection: wasteCostSortDirection
  })
  const recipeConsumptionReport = useRecipeConsumptionReport({
    deductionBatches: stockDeductionBatches,
    stockItems,
    categories,
    movements: stockMovements,
    filters,
    sortKey: recipeConsumptionSortKey,
    sortDirection: recipeConsumptionSortDirection
  })
  const productProfitabilityReport = useProductProfitabilityReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters,
    sortKey: productProfitabilitySortKey,
    sortDirection: productProfitabilitySortDirection
  })
  const salesRevenueReport = useSalesRevenueReport({
    closedBills,
    products,
    users,
    filters,
    sortKey: salesRevenueSortKey,
    sortDirection: salesRevenueSortDirection
  })
  const salesTrendReport = useSalesTrendReport({
    closedBills,
    products,
    users,
    filters,
    sortKey: salesTrendSortKey,
    sortDirection: salesTrendSortDirection
  })
  const stockTurnoverReport = useStockTurnoverReport({
    stockItems,
    categories,
    movements: stockMovements,
    filters,
    sortKey: stockTurnoverSortKey,
    sortDirection: stockTurnoverSortDirection
  })
  const topSellingProductsReport = useTopSellingProductsReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters,
    sortKey: topSellingProductsSortKey,
    sortDirection: topSellingProductsSortDirection
  })
  const lowSellingProductsReport = useLowSellingProductsReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters,
    sortKey: lowSellingProductsSortKey,
    sortDirection: lowSellingProductsSortDirection
  })
  const executiveSalesRevenueReport = useSalesRevenueReport({
    closedBills,
    products,
    users,
    filters: defaultReportFilters,
    sortKey: 'netTotal',
    sortDirection: 'desc'
  })
  const executiveProductProfitabilityReport = useProductProfitabilityReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters: defaultReportFilters,
    sortKey: 'grossProfit',
    sortDirection: 'desc'
  })
  const executiveCriticalStockReport = useCriticalStockReport({
    stockItems,
    categories,
    movements: stockMovements,
    criticalEvents: criticalStockEvents,
    filters: defaultReportFilters,
    sortKey: 'shortage',
    sortDirection: 'desc'
  })
  const executiveExpiringProductsReport = useExpiringProductsReport({
    stockItems,
    categories,
    expiryLots: stockExpiryLots,
    filters: defaultReportFilters,
    sortKey: 'expiryDate',
    sortDirection: 'asc'
  })
  const executiveExpiredProductsReport = useExpiredProductsReport({
    stockItems,
    categories,
    expiryLots: stockExpiryLots,
    filters: defaultReportFilters,
    sortKey: 'expiryDate',
    sortDirection: 'asc'
  })
  const executiveWasteCostReport = useWasteCostReport({
    wasteRecords: stockWasteRecords,
    movements: stockMovements,
    stockItems,
    categories,
    filters: defaultReportFilters,
    sortKey: 'totalCost',
    sortDirection: 'desc'
  })
  const executiveStockTurnoverReport = useStockTurnoverReport({
    stockItems,
    categories,
    movements: stockMovements,
    filters: defaultReportFilters,
    sortKey: 'turnoverRate',
    sortDirection: 'asc'
  })
  const executiveTopSellingProductsReport = useTopSellingProductsReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters: defaultReportFilters,
    sortKey: 'salesQty',
    sortDirection: 'desc'
  })
  const executiveLowSellingProductsReport = useLowSellingProductsReport({
    closedBills,
    products,
    productCategories,
    recipes,
    stockItems,
    filters: defaultReportFilters,
    sortKey: 'salesQty',
    sortDirection: 'asc'
  })
  const executiveDashboardReport = useExecutiveDashboardReport({
    salesRevenueReport: executiveSalesRevenueReport,
    productProfitabilityReport: executiveProductProfitabilityReport,
    criticalStockReport: executiveCriticalStockReport,
    expiringProductsReport: executiveExpiringProductsReport,
    expiredProductsReport: executiveExpiredProductsReport,
    wasteCostReport: executiveWasteCostReport,
    stockTurnoverReport: executiveStockTurnoverReport,
    topSellingProductsReport: executiveTopSellingProductsReport,
    lowSellingProductsReport: executiveLowSellingProductsReport
  })
  const activeKpis = activeTab === 'executive-dashboard'
    ? executiveDashboardReport.kpis
    : activeTab === 'stock-status'
      ? stockStatusReport.kpis
      : activeTab === 'stock-movements'
        ? stockMovementsReport.kpis
        : activeTab === 'critical-stock'
          ? criticalStockReport.kpis
          : activeTab === 'expiry-near'
            ? expiringProductsReport.kpis
            : activeTab === 'expiry-expired'
              ? expiredProductsReport.kpis
              : activeTab === 'waste-cost'
                ? wasteCostReport.kpis
                : activeTab === 'recipe-consumption'
                  ? recipeConsumptionReport.kpis
                  : activeTab === 'product-profitability'
                    ? productProfitabilityReport.kpis
                    : activeTab === 'sales-revenue'
                      ? salesRevenueReport.kpis
                      : activeTab === 'stock-turnover'
                        ? stockTurnoverReport.kpis
                        : activeTab === 'top-selling-products'
                          ? topSellingProductsReport.kpis
                          : activeTab === 'low-selling-products'
                            ? lowSellingProductsReport.kpis
                            : activeTab === 'sales-trend'
                              ? salesTrendReport.kpis
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
      return
    }

    if(activeTab === 'waste-cost'){
      exportWasteCostReportCsv({
        report: wasteCostReport,
        filters,
        categories,
        stockItems,
        users,
        sortKey: wasteCostSortKey,
        sortDirection: wasteCostSortDirection
      })
      return
    }

    if(activeTab === 'recipe-consumption'){
      exportRecipeConsumptionReportCsv({
        report: recipeConsumptionReport,
        filters,
        categories,
        stockItems,
        sortKey: recipeConsumptionSortKey,
        sortDirection: recipeConsumptionSortDirection
      })
      return
    }

    if(activeTab === 'product-profitability'){
      exportProductProfitabilityReportCsv({
        report: productProfitabilityReport,
        filters,
        productCategories,
        products,
        sortKey: productProfitabilitySortKey,
        sortDirection: productProfitabilitySortDirection
      })
      return
    }

    if(activeTab === 'sales-revenue'){
      exportSalesRevenueReportCsv({
        report: salesRevenueReport,
        filters,
        users,
        tables: reportTables,
        sortKey: salesRevenueSortKey,
        sortDirection: salesRevenueSortDirection
      })
      return
    }

    if(activeTab === 'sales-trend'){
      exportSalesTrendReportCsv({
        report: salesTrendReport,
        filters,
        users,
        tables: reportTables,
        sortKey: salesTrendSortKey,
        sortDirection: salesTrendSortDirection
      })
      return
    }

    if(activeTab === 'stock-turnover'){
      exportStockTurnoverReportCsv({
        report: stockTurnoverReport,
        filters,
        categories,
        stockItems,
        sortKey: stockTurnoverSortKey,
        sortDirection: stockTurnoverSortDirection
      })
      return
    }

    if(activeTab === 'top-selling-products'){
      exportTopSellingProductsReportCsv({
        report: topSellingProductsReport,
        filters,
        productCategories,
        products,
        sortKey: topSellingProductsSortKey,
        sortDirection: topSellingProductsSortDirection
      })
      return
    }

    if(activeTab === 'low-selling-products'){
      exportLowSellingProductsReportCsv({
        report: lowSellingProductsReport,
        filters,
        productCategories,
        products,
        sortKey: lowSellingProductsSortKey,
        sortDirection: lowSellingProductsSortDirection
      })
    }
  }

  const usesCompactReportFilters = activeTab === 'critical-stock' || activeTab === 'expiry-near' || activeTab === 'expiry-expired'
  const usesProductFilters = activeTab === 'product-profitability' || activeTab === 'top-selling-products' || activeTab === 'low-selling-products'
  const usesSalesRevenueFilters = activeTab === 'sales-revenue'
  const usesSalesTrendFilters = activeTab === 'sales-trend'
  const usesSalesBillFilters = usesSalesRevenueFilters || usesSalesTrendFilters
  const usesStockTurnoverFilters = activeTab === 'stock-turnover'
  const usesLowSellingFilters = activeTab === 'low-selling-products'
  const reportFilterCategories = usesProductFilters ? productCategories : categories
  const reportFilterItems = usesProductFilters ? products : stockItems
  const canExportCsv = isRealReport(activeTab) && activeTab !== 'executive-dashboard'

  return (
    <div className="reports-page">
      <div className="page-title report-title">
        <div>
          <h2>Raporlama</h2>
          <p className="muted">Stok, SKT, lot, reçete ve fire verileri için merkezi rapor altyapısı.</p>
        </div>
        <div className="report-title-actions report-export-actions">
          <button className="btn" type="button" onClick={exportCsv} disabled={!canExportCsv}>CSV Dışa Aktar</button>
          <button className="btn" type="button" disabled>PDF Dışa Aktar</button>
        </div>
      </div>

      <ReportKpis items={activeKpis} />

      <section className="card report-center-card">
        <div className="section-header compact">
          <div>
            <h3>Rapor Türleri</h3>
            <p className="muted">Ana raporları seçin; filtreler ve dışa aktarma seçili rapora göre güncellenir.</p>
          </div>
          <span className="status-pill">14 aktif rapor</span>
        </div>
        <ReportTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {activeTab !== 'executive-dashboard' && (
        <ReportFilters
          filters={filters}
          categories={reportFilterCategories}
          stockItems={reportFilterItems}
          users={users}
          tables={reportTables}
          onChange={setFilters}
          showMovementTypeFilter={activeTab === 'stock-movements'}
          showCriticalStatusFilter={activeTab === 'critical-stock'}
          showExpiryStatusFilter={activeTab === 'expiry-near'}
          showExpiredStatusFilter={activeTab === 'expiry-expired'}
          showWasteReasonFilter={activeTab === 'waste-cost'}
          showTurnoverStatusFilter={usesStockTurnoverFilters}
          showLowSellingStatusFilter={usesLowSellingFilters}
          showDateFilters={!usesCompactReportFilters}
          showCategoryFilter={!usesSalesBillFilters}
          showStockItemFilter={!usesSalesBillFilters}
          showPersonnelFilter={!usesCompactReportFilters && activeTab !== 'recipe-consumption' && !usesProductFilters && !usesStockTurnoverFilters}
          showTableFilter={usesSalesBillFilters}
          stockItemFilterLabel={activeTab === 'recipe-consumption' ? 'Hammadde' : 'Ürün'}
          stockItemAllLabel={activeTab === 'recipe-consumption' ? 'Tüm hammaddeler' : 'Tüm ürünler'}
          searchPlaceholderOverride={activeTab === 'recipe-consumption'
            ? 'Hammadde adı veya kategori'
            : activeTab === 'product-profitability'
              ? 'Ürün adı veya kategori'
              : activeTab === 'sales-revenue'
                ? 'Adisyon no, kullanıcı veya masa'
                : activeTab === 'sales-trend'
                  ? 'Kullanıcı veya masa'
                  : activeTab === 'stock-turnover'
                    ? 'Ürün adı veya kategori'
                    : activeTab === 'top-selling-products'
                      ? 'Ürün adı veya kategori'
                      : activeTab === 'low-selling-products'
                        ? 'Ürün adı veya kategori'
                        : undefined}
        />
      )}

      {activeTab === 'executive-dashboard' ? (
        <ExecutiveDashboardReport report={executiveDashboardReport} onOpenReport={setActiveTab} />
      ) : activeTab === 'stock-status' ? (
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
      ) : activeTab === 'waste-cost' ? (
        <WasteCostReport
          report={wasteCostReport}
          sortKey={wasteCostSortKey}
          sortDirection={wasteCostSortDirection}
          onSortKeyChange={setWasteCostSortKey}
          onSortDirectionChange={setWasteCostSortDirection}
        />
      ) : activeTab === 'recipe-consumption' ? (
        <RecipeConsumptionReport
          report={recipeConsumptionReport}
          sortKey={recipeConsumptionSortKey}
          sortDirection={recipeConsumptionSortDirection}
          onSortKeyChange={setRecipeConsumptionSortKey}
          onSortDirectionChange={setRecipeConsumptionSortDirection}
        />
      ) : activeTab === 'product-profitability' ? (
        <ProductProfitabilityReport
          report={productProfitabilityReport}
          sortKey={productProfitabilitySortKey}
          sortDirection={productProfitabilitySortDirection}
          onSortKeyChange={setProductProfitabilitySortKey}
          onSortDirectionChange={setProductProfitabilitySortDirection}
        />
      ) : activeTab === 'sales-revenue' ? (
        <SalesRevenueReport
          report={salesRevenueReport}
          sortKey={salesRevenueSortKey}
          sortDirection={salesRevenueSortDirection}
          onSortKeyChange={setSalesRevenueSortKey}
          onSortDirectionChange={setSalesRevenueSortDirection}
        />
      ) : activeTab === 'sales-trend' ? (
        <SalesTrendReport
          report={salesTrendReport}
          sortKey={salesTrendSortKey}
          sortDirection={salesTrendSortDirection}
          onSortKeyChange={setSalesTrendSortKey}
          onSortDirectionChange={setSalesTrendSortDirection}
        />
      ) : activeTab === 'stock-turnover' ? (
        <StockTurnoverReport
          report={stockTurnoverReport}
          sortKey={stockTurnoverSortKey}
          sortDirection={stockTurnoverSortDirection}
          onSortKeyChange={setStockTurnoverSortKey}
          onSortDirectionChange={setStockTurnoverSortDirection}
        />
      ) : activeTab === 'top-selling-products' ? (
        <TopSellingProductsReport
          report={topSellingProductsReport}
          sortKey={topSellingProductsSortKey}
          sortDirection={topSellingProductsSortDirection}
          onSortKeyChange={setTopSellingProductsSortKey}
          onSortDirectionChange={setTopSellingProductsSortDirection}
        />
      ) : activeTab === 'low-selling-products' ? (
        <LowSellingProductsReport
          report={lowSellingProductsReport}
          sortKey={lowSellingProductsSortKey}
          sortDirection={lowSellingProductsSortDirection}
          onSortKeyChange={setLowSellingProductsSortKey}
          onSortDirectionChange={setLowSellingProductsSortDirection}
        />
      ) : (
        <ReportPlaceholder activeTab={activeTab} />
      )}
    </div>
  )
}
