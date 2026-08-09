import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
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
  { id: 'EXECUTIVE', label: 'Yönetici Dashboard' },
  { id: 'PRODUCTION', label: 'Üretim KPI' },
  { id: 'INVENTORY', label: 'Depo KPI' },
  { id: 'QUALITY', label: 'Kalite KPI' },
  { id: 'PURCHASING', label: 'Satın Alma KPI' },
  { id: 'SHIPMENT', label: 'Sevkiyat KPI' }
]

const PERIOD_OPTIONS: Array<{ value: KpiFilters['period']; label: string }> = [
  { value: 'TODAY', label: 'Bugün' },
  { value: 'WEEK', label: 'Bu Hafta' },
  { value: 'MONTH', label: 'Bu Ay' },
  { value: 'YEAR', label: 'Bu Yıl' }
]

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const normalizeText = (value: unknown) => String(value ?? '').trim()

const parseSafeDate = (value: unknown) => {
  const text = normalizeText(value)
  if(!text) return null
  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const toExportDateKey = () => new Date().toLocaleDateString('sv-SE')

const formatDateTime = (value: unknown) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
    : '-'
}

const escapeHtml = (value: unknown) => normalizeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const getChartValue = (value: number) => Number.isFinite(value) && value > 0 ? value : 0

const getTabLabel = (activeTab: KpiDashboardTab) => (
  DASHBOARD_TABS.find(tab => tab.id === activeTab)?.label || 'KPI Dashboard'
)

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
        { title: 'Ürün Bazlı Üretim', rows: dashboard.production.productProduction },
        { title: 'Hat Bazlı Üretim', rows: dashboard.production.lineProduction },
        { title: 'Operatör Bazlı Üretim', rows: dashboard.production.operatorProduction }
      ],
      pies: [dashboard.executive.pieCharts.productionDistribution]
    }
  }

  if(activeTab === 'INVENTORY'){
    return {
      trends: [dashboard.inventory.inventoryTrend],
      bars: [
        { title: 'Depo Doluluk', rows: dashboard.inventory.warehouseOccupancy },
        { title: 'En Çok Kullanılan Hammaddeler', rows: dashboard.inventory.mostUsedRawMaterials }
      ],
      pies: [dashboard.inventory.inventoryDistribution]
    }
  }

  if(activeTab === 'QUALITY'){
    return {
      trends: [dashboard.quality.monitoringTrend, dashboard.quality.recallTrend],
      bars: [{ title: 'En Çok CCP Hatası', rows: dashboard.quality.ccpFailures }],
      pies: [dashboard.quality.qualityStatus]
    }
  }

  if(activeTab === 'PURCHASING'){
    return {
      trends: [],
      bars: [
        { title: 'Tedarikçi Performansı', rows: dashboard.purchasing.supplierPerformance },
        { title: 'En İyi Tedarikçiler', rows: dashboard.purchasing.topSuppliers }
      ],
      pies: []
    }
  }

  if(activeTab === 'SHIPMENT'){
    return {
      trends: [dashboard.shipment.shipmentTrend],
      bars: [{ title: 'Araç Doluluk', rows: dashboard.shipment.vehicleUtilization }],
      pies: [dashboard.shipment.shipmentStatus]
    }
  }

  return {
    trends: dashboard.executive.lineCharts,
    bars: [
      { title: 'Öne Çıkan Ürünler', rows: dashboard.executive.barCharts.topProducts },
      { title: 'Öne Çıkan Tedarikçiler', rows: dashboard.executive.barCharts.topSuppliers },
      { title: 'Öne Çıkan Depolar', rows: dashboard.executive.barCharts.topWarehouses },
      { title: 'En Çok CCP Hatası', rows: dashboard.executive.barCharts.topCcpFailures }
    ],
    pies: [
      dashboard.executive.pieCharts.inventoryDistribution,
      dashboard.executive.pieCharts.productionDistribution,
      dashboard.executive.pieCharts.shipmentStatus,
      dashboard.executive.pieCharts.qualityStatus
    ]
  }
}

type KpiChartCollections = ReturnType<typeof getChartsForTab>

const mapKpiCardsForOutput = (
  cards: KPICard[],
  activeTabLabel: string
) => cards.map(card => ({
  Sekme: activeTabLabel,
  KPI: card.label,
  Değer: card.value,
  Detay: card.detail,
  Durum: card.tone
}))

const mapTrendRowsForOutput = (charts: KpiChartCollections) => charts.trends.flatMap(series => (
  series.points.map(point => ({
    Grafik: series.label,
    Dönem: point.label,
    Tarih: point.dateKey,
    Değer: getChartValue(point.value)
  }))
))

const mapBarRowsForOutput = (charts: KpiChartCollections) => charts.bars.flatMap(chart => (
  chart.rows.map(row => ({
    Grafik: chart.title,
    Kayıt: row.label,
    Değer: getChartValue(row.value),
    'Formatlı Değer': row.formattedValue,
    Detay: row.detail
  }))
))

const mapPieRowsForOutput = (
  charts: KpiChartCollections,
  activeTab: KpiDashboardTab
) => charts.pies.flatMap((slices, index) => (
  slices.map(slice => ({
    Grafik: getPieTitle(activeTab, index),
    Dilim: slice.label,
    Değer: getChartValue(slice.value),
    'Formatlı Değer': slice.formattedValue
  }))
))

const mapReportsForOutput = (dashboard: KpiDashboardView) => dashboard.reports.map(report => ({
  Rapor: report.title,
  Açıklama: report.description,
  Sahip: report.owner
}))

const exportKpiDashboard = (
  dashboard: KpiDashboardView,
  cards: KPICard[],
  charts: KpiChartCollections,
  activeTab: KpiDashboardTab,
  activeTabLabel: string
) => {
  ExcelIntegrationService.exportWorkbook({
    moduleKeys: ['kpi'],
    moduleLabel: 'KPI Dashboard',
    fileNamePrefix: 'kpi-dashboard-filtreli',
    fileName: `kpi-dashboard-filtreli-${toExportDateKey()}.xlsx`,
    userName: ExcelIntegrationService.defaultUserName,
    sheets: [
      { sheetName: 'KPI Kartları', rows: mapKpiCardsForOutput(cards, activeTabLabel) },
      { sheetName: 'Trendler', rows: mapTrendRowsForOutput(charts) },
      { sheetName: 'Bar Grafikler', rows: mapBarRowsForOutput(charts) },
      { sheetName: 'Dağılımlar', rows: mapPieRowsForOutput(charts, activeTab) },
      { sheetName: 'Raporlar', rows: mapReportsForOutput(dashboard) }
    ]
  })
}

const openKpiPrintWindow = (
  dashboard: KpiDashboardView,
  cards: KPICard[],
  charts: KpiChartCollections,
  activeTabLabel: string,
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if(!printWindow) return false

  const kpiHtml = cards.map(card => `
    <article>
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.detail)}</small>
    </article>
  `).join('')
  const trendRows = mapTrendRowsForOutput(charts).slice(0, 80).map(row => `
    <tr>
      <td>${escapeHtml(row.Grafik)}</td>
      <td>${escapeHtml(row.Dönem)}</td>
      <td>${escapeHtml(row.Tarih)}</td>
      <td>${escapeHtml(formatNumber(row.Değer, 1))}</td>
    </tr>
  `).join('')
  const barRows = mapBarRowsForOutput(charts).slice(0, 80).map(row => `
    <tr>
      <td>${escapeHtml(row.Grafik)}</td>
      <td>${escapeHtml(row.Kayıt)}</td>
      <td>${escapeHtml(row['Formatlı Değer'])}</td>
      <td>${escapeHtml(row.Detay)}</td>
    </tr>
  `).join('')
  const reportRows = dashboard.reports.slice(0, 80).map(report => `
    <tr>
      <td>${escapeHtml(report.title)}</td>
      <td>${escapeHtml(report.description)}</td>
      <td>${escapeHtml(report.owner)}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>KPI Dashboard ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
          h1 { margin:0; font-size:24px; }
          h2 { margin:${PRINT_SPACING_VALUES.space20} 0 ${PRINT_SPACING_VALUES.space8}; font-size:16px; }
          p { margin:${PRINT_SPACING_VALUES.space4} 0 ${PRINT_SPACING_VALUES.space16}; color:${PRINT_THEME_COLORS.textMutedStrong}; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:${PRINT_SPACING_VALUES.space8}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
          article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:8px; padding:${PRINT_SPACING_VALUES.space12}; page-break-inside:avoid; }
          article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
          article strong { display:block; margin:${PRINT_SPACING_VALUES.space4} 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
          th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
          th { background:${PRINT_THEME_COLORS.pageBackground}; }
          @media print { body { padding:${PRINT_SPACING_VALUES.space16}; } }
        </style>
      </head>
      <body>
        <h1>KPI Dashboard</h1>
        <p>${escapeHtml(activeTabLabel)} / ${escapeHtml(getFilterLabel(dashboard.filters))} / Analiz: ${escapeHtml(formatDateTime(dashboard.generatedAt))}</p>
        <section class="grid">${kpiHtml}</section>
        <h2>Trendler</h2>
        <table>
          <thead><tr><th>Grafik</th><th>Dönem</th><th>Tarih</th><th>Değer</th></tr></thead>
          <tbody>${trendRows || '<tr><td colspan="4">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <h2>Grafikler</h2>
        <table>
          <thead><tr><th>Grafik</th><th>Kayıt</th><th>Değer</th><th>Detay</th></tr></thead>
          <tbody>${barRows || '<tr><td colspan="4">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <h2>Raporlar</h2>
        <table>
          <thead><tr><th>Rapor</th><th>Açıklama</th><th>Sahip</th></tr></thead>
          <tbody>${reportRows || '<tr><td colspan="3">Rapor bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
  return true
}

export default function KPIDashboard({ currentUser }: { currentUser: User }){
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [filters, setFilters] = React.useState<KpiFilters>(() => createDefaultKpiFilters())
  const [activeTab, setActiveTab] = React.useState<KpiDashboardTab>('EXECUTIVE')
  const [exportMessage, setExportMessage] = React.useState('')
  const dashboard = React.useMemo(() => createKpiDashboardView(sourceData, filters), [sourceData, filters])
  const cards = getCardsForTab(dashboard, activeTab)
  const charts = getChartsForTab(dashboard, activeTab)
  const activeTabLabel = getTabLabel(activeTab)
  const productOptions = React.useMemo(() => getProductOptions(sourceData), [sourceData])
  const warehouseOptions = React.useMemo(() => getWarehouseOptions(sourceData), [sourceData])
  const operatorOptions = React.useMemo(() => getOperatorOptions(sourceData), [sourceData])

  const updateFilter = <TKey extends keyof KpiFilters>(key: TKey, value: KpiFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleExport = (format: KpiExportFormat) => {
    try {
      if(format === 'EXCEL'){
        exportKpiDashboard(dashboard, cards, charts, activeTab, activeTabLabel)
        setExportMessage('Filtreli Excel çıktısı hazırlandı.')
        return
      }

      const opened = openKpiPrintWindow(dashboard, cards, charts, activeTabLabel, format)
      setExportMessage(opened
        ? `${format === 'PDF' ? 'Filtreli PDF' : 'Filtreli Yazdır'} çıktısı hazırlandı.`
        : 'Tarayıcı çıktı penceresini engelledi. Pop-up izni verip tekrar deneyin.'
      )
    } catch {
      setExportMessage('Export sırasında hata oluştu. Filtreleri sıfırlayıp tekrar deneyin.')
    }
  }

  return (
    <div className="kpi-dashboard-page">
      <div className="page-header">
        <div>
          <h2>KPI Dashboard</h2>
          <p className="muted">Read Model tabanlı yönetici, üretim, depo, kalite, satın alma ve sevkiyat KPI merkezi.</p>
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
            <p className="muted">{getFilterLabel(filters)} filtresi ile hesaplandı. Son üretim: {formatDateTime(dashboard.generatedAt)}</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultKpiFilters())}>Sıfırla</button>
        </div>
        <div className="kpi-filter-grid">
          <label className="form-field">
            <span>Dönem</span>
            <select value={filters.period} onChange={event => updateFilter('period', event.target.value as KpiFilters['period'])}>
              {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {sourceData.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Depo</span>
            <select value={filters.warehouseId} onChange={event => updateFilter('warehouseId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Depolar</option>
              {warehouseOptions.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Ürün</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Ürünler</option>
              {productOptions.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Lotlar</option>
              {sourceData.inventoryLots.map(lot => <option key={lot.id} value={lot.id}>{lot.lotNo}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tedarikçi</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Tedarikçiler</option>
              {sourceData.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Operatör</span>
            <select value={filters.operator} onChange={event => updateFilter('operator', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Operatörler</option>
              {operatorOptions.map(operator => <option key={operator} value={operator}>{operator}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="kpi-tabs" role="tablist" aria-label="KPI dashboard bölümleri">
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
          <h3>Yönetici Özeti</h3>
          <p className="muted">Karar Destek fazı için tek merkezli KPI veri kaynağı.</p>
        </div>
        <span className="status-pill">{formatNumber(totalTrendPoints)} trend noktası</span>
      </div>
      <div className="kpi-narrative-grid">
        <div><span>Trend Grafikler</span><strong>Üretim, sevkiyat, fire, izleme, recall ve depo</strong></div>
        <div><span>Bar Grafikler</span><strong>Ürün, tedarikçi, depo ve CCP kırılımları</strong></div>
        <div><span>Dağılım Grafikler</span><strong>Depo, üretim, sevkiyat ve kalite durumları</strong></div>
      </div>
    </section>
  )
}

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => getChartValue(point.value)))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{series.points.length} dönem noktası</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.map(point => (
          <div className="kpi-line-point" key={point.dateKey}>
            <span style={{ height: `${Math.max(4, (getChartValue(point.value) / maxValue) * 100)}%`, background: series.color }} />
            <strong>{formatNumber(getChartValue(point.value), 1)}</strong>
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
  const maxValue = Math.max(1, ...rows.map(row => getChartValue(row.value)))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{rows.length} kayıt</p>
        </div>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <div className="empty-cell">Kayıt bulunamadı.</div>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail || row.formattedValue}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (getChartValue(row.value) / maxValue) * 100)}%` }} />
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
  const total = slices.reduce((sum, slice) => sum + getChartValue(slice.value), 0)
  let cursor = 0
  const background = slices.length > 0
    ? `conic-gradient(${slices.map(slice => {
      const start = cursor
      const size = total > 0 ? (getChartValue(slice.value) / total) * 100 : 0
      cursor += size
      return `${slice.color} ${start}% ${cursor}%`
    }).join(', ')})`
    : 'var(--surface-muted)'

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(total, 1)} toplam değer</p>
        </div>
      </div>
      <div className="kpi-pie-layout">
        <div className="kpi-pie" style={{ background }} />
        <div className="kpi-pie-legend">
          {slices.length === 0 && <div className="empty-cell">Dağılım verisi yok.</div>}
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
          <h3>Raporlar ve Çıktılar</h3>
          <p className="muted">Üretim, depo, kalite, satın alma, sevkiyat ve yönetici özeti için filtreli çıktı arayüzü.</p>
        </div>
        <div className="kpi-export-actions">
          <button className="btn" type="button" onClick={() => onExport('EXCEL')}>Filtreli Excel</button>
          <button className="btn" type="button" onClick={() => onExport('PDF')}>Filtreli PDF</button>
          <button className="btn" type="button" onClick={() => onExport('PRINT')}>Filtreli Yazdır</button>
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
    return ['Depo Dağılımı', 'Üretim Dağılımı', 'Sevkiyat Durumu', 'Kalite Durumu'][index] || 'Dağılım'
  }
  if(activeTab === 'PRODUCTION') return 'Üretim Dağılımı'
  if(activeTab === 'INVENTORY') return 'Depo Dağılımı'
  if(activeTab === 'QUALITY') return 'Kalite Durumu'
  if(activeTab === 'SHIPMENT') return 'Sevkiyat Durumu'
  return 'Dağılım'
}
