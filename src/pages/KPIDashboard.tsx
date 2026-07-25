import React from 'react'
import { createDefaultKpiFilters, createKpiDashboardView } from '../kpi-reporting/kpi.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type {
  BarChartRow,
  ChartSeries,
  ExecutiveSummary,
  KPICard,
  KpiDashboardTab,
  KpiDashboardView,
  KpiExportFormat,
  KpiFilters,
  KpiSourceData,
  PieChartSlice
} from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  getFilterLabel
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

const DASHBOARD_TABS: Array<{ id: KpiDashboardTab; label: string }> = [
  { id: 'EXECUTIVE', label: 'Executive Dashboard' },
  { id: 'PRODUCTION', label: 'Production KPI' },
  { id: 'INVENTORY', label: 'Inventory KPI' },
  { id: 'QUALITY', label: 'Quality KPI' },
  { id: 'PURCHASING', label: 'Purchasing KPI' },
  { id: 'SHIPMENT', label: 'Shipment KPI' }
]

const PERIOD_OPTIONS: Array<{ value: KpiFilters['period']; label: string }> = [
  { value: 'TODAY', label: 'Bugun' },
  { value: 'WEEK', label: 'Bu Hafta' },
  { value: 'MONTH', label: 'Bu Ay' },
  { value: 'YEAR', label: 'Bu Yil' }
]

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
}

const getProductOptions = (sourceData: KpiSourceData) => {
  const optionMap = new Map<string, string>()
  sourceData.productRefs.forEach(product => optionMap.set(product.id, product.name))
  sourceData.stockItems.forEach(item => {
    if(!optionMap.has(item.id)) optionMap.set(item.id, item.name)
  })
  return Array.from(optionMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const getWarehouseOptions = (sourceData: KpiSourceData) => {
  const warehouseIds = new Set(sourceData.inventoryLots.map(lot => lot.warehouseId).filter(Boolean))
  return Array.from(warehouseIds)
    .map(id => ({
      id,
      name: sourceData.branches.find(branch => branch.id === id)?.name || id
    }))
    .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const getOperatorOptions = (sourceData: KpiSourceData) => {
  const names = new Set<string>()
  sourceData.productionOrders.forEach(order => {
    if(order.requester) names.add(order.requester)
  })
  sourceData.productionLines.forEach(line => {
    if(line.activeOperator) names.add(line.activeOperator)
    if(line.responsible) names.add(line.responsible)
  })
  sourceData.haccpRecords.forEach(plan => {
    plan.monitoringRecords.forEach(record => record.checkedBy && names.add(record.checkedBy))
    plan.verificationRecords.forEach(record => record.verifiedBy && names.add(record.verifiedBy))
  })
  sourceData.shipmentVehicles.forEach(vehicle => {
    if(vehicle.driverName) names.add(vehicle.driverName)
  })

  return Array.from(names).sort((first, second) => first.localeCompare(second, 'tr-TR'))
}

const getCardsForTab = (
  dashboard: KpiDashboardView,
  activeTab: KpiDashboardTab
): KPICard[] => {
  if(activeTab === 'EXECUTIVE') return dashboard.executive.cards
  if(activeTab === 'PRODUCTION') return dashboard.production.cards
  if(activeTab === 'INVENTORY') return dashboard.inventory.cards
  if(activeTab === 'QUALITY') return dashboard.quality.cards
  if(activeTab === 'PURCHASING') return dashboard.purchasing.cards
  return dashboard.shipment.cards
}

const getChartsForTab = (
  dashboard: KpiDashboardView,
  activeTab: KpiDashboardTab
) => {
  if(activeTab === 'PRODUCTION'){
    return {
      trends: [dashboard.production.productionTrend],
      bars: [
        { title: 'Urun Bazli Uretim', rows: dashboard.production.productProduction },
        { title: 'Hat Bazli Uretim', rows: dashboard.production.lineProduction },
        { title: 'Operator Bazli Uretim', rows: dashboard.production.operatorProduction }
      ],
      pies: [dashboard.executive.pieCharts.productionDistribution]
    }
  }

  if(activeTab === 'INVENTORY'){
    return {
      trends: [dashboard.inventory.inventoryTrend],
      bars: [
        { title: 'Depo Doluluk', rows: dashboard.inventory.warehouseOccupancy },
        { title: 'En Cok Kullanilan Hammaddeler', rows: dashboard.inventory.mostUsedRawMaterials }
      ],
      pies: [dashboard.inventory.inventoryDistribution]
    }
  }

  if(activeTab === 'QUALITY'){
    return {
      trends: [dashboard.quality.monitoringTrend, dashboard.quality.recallTrend],
      bars: [{ title: 'Top CCP Failures', rows: dashboard.quality.ccpFailures }],
      pies: [dashboard.quality.qualityStatus]
    }
  }

  if(activeTab === 'PURCHASING'){
    return {
      trends: [],
      bars: [
        { title: 'Supplier Performance', rows: dashboard.purchasing.supplierPerformance },
        { title: 'Top Suppliers', rows: dashboard.purchasing.topSuppliers }
      ],
      pies: []
    }
  }

  if(activeTab === 'SHIPMENT'){
    return {
      trends: [dashboard.shipment.shipmentTrend],
      bars: [{ title: 'Arac Doluluk', rows: dashboard.shipment.vehicleUtilization }],
      pies: [dashboard.shipment.shipmentStatus]
    }
  }

  return {
    trends: dashboard.executive.lineCharts,
    bars: [
      { title: 'Top Products', rows: dashboard.executive.barCharts.topProducts },
      { title: 'Top Suppliers', rows: dashboard.executive.barCharts.topSuppliers },
      { title: 'Top Warehouses', rows: dashboard.executive.barCharts.topWarehouses },
      { title: 'Top CCP Failures', rows: dashboard.executive.barCharts.topCcpFailures }
    ],
    pies: [
      dashboard.executive.pieCharts.inventoryDistribution,
      dashboard.executive.pieCharts.productionDistribution,
      dashboard.executive.pieCharts.shipmentStatus,
      dashboard.executive.pieCharts.qualityStatus
    ]
  }
}

export default function KPIDashboard({ currentUser }: { currentUser: User }){
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [filters, setFilters] = React.useState<KpiFilters>(() => createDefaultKpiFilters())
  const [activeTab, setActiveTab] = React.useState<KpiDashboardTab>('EXECUTIVE')
  const [exportMessage, setExportMessage] = React.useState('')
  const dashboard = React.useMemo(() => createKpiDashboardView(sourceData, filters), [sourceData, filters])
  const cards = getCardsForTab(dashboard, activeTab)
  const charts = getChartsForTab(dashboard, activeTab)
  const productOptions = React.useMemo(() => getProductOptions(sourceData), [sourceData])
  const warehouseOptions = React.useMemo(() => getWarehouseOptions(sourceData), [sourceData])
  const operatorOptions = React.useMemo(() => getOperatorOptions(sourceData), [sourceData])

  const updateFilter = <TKey extends keyof KpiFilters>(key: TKey, value: KpiFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleExport = (format: KpiExportFormat) => {
    setExportMessage(`${format} export servisi hazir. Gercek dosya uretimi sonraki entegrasyon fazinda baglanacak.`)
  }

  return (
    <div className="kpi-dashboard-page">
      <div className="page-header">
        <div>
          <h2>KPI Dashboard</h2>
          <p className="muted">Read Model tabanli Executive, Production, Inventory, Quality, Purchasing ve Shipment KPI merkezi.</p>
        </div>
        <div className="kpi-header-actions">
          <span className="status-pill success">Read Model</span>
          <span className="muted">{getUserName(currentUser)}</span>
        </div>
      </div>

      <section className="card kpi-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{getFilterLabel(filters)} filtresi ile hesaplandi. Son uretim: {formatDateTime(dashboard.generatedAt)}</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultKpiFilters())}>Sifirla</button>
        </div>
        <div className="kpi-filter-grid">
          <label className="form-field">
            <span>Donem</span>
            <select value={filters.period} onChange={event => updateFilter('period', event.target.value as KpiFilters['period'])}>
              {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Subeler</option>
              {sourceData.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Depolar</option>
              {warehouseOptions.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Urun</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Urunler</option>
              {productOptions.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Lotlar</option>
              {sourceData.inventoryLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tedarikci</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Tedarikciler</option>
              {sourceData.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Operator</span>
            <select value={filters.operator} onChange={event => updateFilter('operator', event.target.value)}>
              <option value={ALL_FILTER}>Tum Operatorler</option>
              {operatorOptions.map(operator => <option key={operator} value={operator}>{operator}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="kpi-tabs" role="tablist" aria-label="KPI dashboard bolumleri">
        {DASHBOARD_TABS.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <KpiCardGrid cards={cards} />

      {activeTab === 'EXECUTIVE' && <ExecutiveNarrative summary={dashboard.executive} />}

      <div className="kpi-chart-grid">
        {charts.trends.map(series => <LineChartCard key={series.id} series={series} />)}
      </div>

      <div className="kpi-insight-grid">
        {charts.bars.map(chart => <BarChartCard key={chart.title} title={chart.title} rows={chart.rows} />)}
        {charts.pies.map((slices, index) => (
          <PieChartCard key={`${activeTab}-pie-${index}`} title={getPieTitle(activeTab, index)} slices={slices} />
        ))}
      </div>

      <ReportsPanel
        dashboard={dashboard}
        exportMessage={exportMessage}
        onExport={handleExport}
      />
    </div>
  )
}

function KpiCardGrid({ cards }: { cards: KPICard[] }){
  return (
    <div className="metric-grid kpi-card-grid">
      {cards.map(card => (
        <div className={`metric-card kpi-card ${card.tone}`} key={card.id}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.detail}</small>
        </div>
      ))}
    </div>
  )
}

function ExecutiveNarrative({ summary }: { summary: ExecutiveSummary }){
  const totalTrendPoints = summary.lineCharts.reduce((total, series) => total + series.points.length, 0)

  return (
    <section className="card kpi-narrative-card">
      <div className="section-header compact">
        <div>
          <h3>Executive Summary</h3>
          <p className="muted">Decision Support fazi icin tek merkezli KPI veri kaynagi.</p>
        </div>
        <span className="status-pill">{formatNumber(totalTrendPoints)} trend point</span>
      </div>
      <div className="kpi-narrative-grid">
        <div><span>Line Chart</span><strong>Production, Shipment, Fire, Monitoring, Recall, Inventory</strong></div>
        <div><span>Bar Chart</span><strong>Top Products, Suppliers, Warehouses, CCP Failures</strong></div>
        <div><span>Pie Chart</span><strong>Inventory, Production, Shipment, Quality Status</strong></div>
      </div>
    </section>
  )
}

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{series.points.length} period point</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.map(point => (
          <div className="kpi-line-point" key={point.dateKey}>
            <span style={{ height: `${Math.max(4, (point.value / maxValue) * 100)}%`, background: series.color }} />
            <strong>{formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function BarChartCard({
  rows,
  title
}: {
  rows: BarChartRow[]
  title: string
}){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{rows.length} kayit</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayit bulunamadi.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function PieChartCard({
  slices,
  title
}: {
  slices: PieChartSlice[]
  title: string
}){
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let cursor = 0
  const background = slices.length > 0
    ? `conic-gradient(${slices.map(slice => {
      const start = cursor
      const size = total > 0 ? (slice.value / total) * 100 : 0
      cursor += size
      return `${slice.color} ${start}% ${cursor}%`
    }).join(', ')})`
    : 'var(--surface-muted)'

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(total, 1)} toplam deger</p>
        </div>
      </div>
      <div className="kpi-pie-layout">
        <div className="kpi-pie" style={{ background }} />
        <div className="kpi-pie-legend">
          {slices.length === 0 && <div className="empty-cell">Dagilim verisi yok.</div>}
          {slices.map(slice => (
            <div className="kpi-pie-row" key={slice.id}>
              <span style={{ background: slice.color }} />
              <strong>{slice.label}</strong>
              <em>{slice.formattedValue}</em>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReportsPanel({
  dashboard,
  exportMessage,
  onExport
}: {
  dashboard: KpiDashboardView
  exportMessage: string
  onExport: (format: KpiExportFormat) => void
}){
  return (
    <section className="card kpi-report-panel">
      <div className="section-header compact">
        <div>
          <h3>Raporlar ve Export</h3>
          <p className="muted">Production, Inventory, Quality, Purchasing, Shipment ve Executive Summary raporlari icin export arayuzu.</p>
        </div>
        <div className="kpi-export-actions">
          <button className="btn" type="button" onClick={() => onExport('CSV')}>CSV</button>
          <button className="btn" type="button" onClick={() => onExport('EXCEL')}>Excel</button>
          <button className="btn" type="button" onClick={() => onExport('PDF')}>PDF</button>
        </div>
      </div>
      {exportMessage && <div className="form-success">{exportMessage}</div>}
      <div className="kpi-report-grid">
        {dashboard.reports.map(report => (
          <div className="kpi-report-row" key={report.id}>
            <strong>{report.title}</strong>
            <span>{report.description}</span>
            <small>{report.owner}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

const getPieTitle = (activeTab: KpiDashboardTab, index: number) => {
  if(activeTab === 'EXECUTIVE'){
    return ['Inventory Distribution', 'Production Distribution', 'Shipment Status', 'Quality Status'][index] || 'Distribution'
  }
  if(activeTab === 'PRODUCTION') return 'Production Distribution'
  if(activeTab === 'INVENTORY') return 'Inventory Distribution'
  if(activeTab === 'QUALITY') return 'Quality Status'
  if(activeTab === 'SHIPMENT') return 'Shipment Status'
  return 'Distribution'
}
