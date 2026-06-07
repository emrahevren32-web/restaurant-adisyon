import React from 'react'
import ReportFilters, { defaultReportFilters, ReportFiltersValue } from '../components/reports/ReportFilters'
import ReportKpis, { ReportKpi } from '../components/reports/ReportKpis'
import ReportPlaceholder from '../components/reports/ReportPlaceholder'
import ReportTabs, { ReportTabId } from '../components/reports/ReportTabs'
import StockStatusReport, {
  exportStockStatusReportCsv,
  StockStatusSortDirection,
  StockStatusSortKey,
  useStockStatusReport
} from '../components/reports/StockStatusReport'
import { loadStockCategories, loadStockExpiryLots, loadStockItems, loadStockMovements, loadUsers } from '../storage'

const placeholderKpis: ReportKpi[] = [
  { label: 'Toplam Stok Değeri', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Kritik Ürün Sayısı', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'SKT Riski', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'Fire Maliyeti', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Fire Veren Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' },
  { label: 'En Çok Tüketilen Ürün', value: '-', detail: 'Faz 12.8.x hesaplaması' }
]

export default function Reports(){
  const [activeTab, setActiveTab] = React.useState<ReportTabId>('stock-status')
  const [filters, setFilters] = React.useState<ReportFiltersValue>(defaultReportFilters)
  const [stockStatusSortKey, setStockStatusSortKey] = React.useState<StockStatusSortKey>('name')
  const [stockStatusSortDirection, setStockStatusSortDirection] = React.useState<StockStatusSortDirection>('asc')
  const [categories] = React.useState(() => loadStockCategories())
  const [stockItems] = React.useState(() => loadStockItems())
  const [stockMovements] = React.useState(() => loadStockMovements())
  const [stockExpiryLots] = React.useState(() => loadStockExpiryLots())
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
  const activeKpis = activeTab === 'stock-status' ? stockStatusReport.kpis : placeholderKpis

  const exportCsv = () => {
    if(activeTab !== 'stock-status') return

    exportStockStatusReportCsv({
      report: stockStatusReport,
      filters,
      categories,
      stockItems
    })
  }

  return (
    <div className="reports-page">
      <div className="page-title">
        <div>
          <h2>Raporlama</h2>
          <p className="muted">Stok, SKT, lot, reçete ve fire verileri için merkezi rapor altyapısı.</p>
        </div>
        <div className="report-export-actions">
          <button className="btn" type="button" onClick={exportCsv} disabled={activeTab !== 'stock-status'}>CSV Dışa Aktar</button>
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
      />

      {activeTab === 'stock-status' ? (
        <StockStatusReport
          report={stockStatusReport}
          sortKey={stockStatusSortKey}
          sortDirection={stockStatusSortDirection}
          onSortKeyChange={setStockStatusSortKey}
          onSortDirectionChange={setStockStatusSortDirection}
        />
      ) : (
        <ReportPlaceholder activeTab={activeTab} />
      )}
    </div>
  )
}
