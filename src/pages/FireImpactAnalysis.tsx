import React from 'react'
import { createDefaultFireAnalysisFilters, createFireAnalysisView } from '../fire-impact/fire-analysis.service'
import { FIRE_CATEGORIES } from '../fire-impact/fire-impact.service'
import type { FireAnalysisFilters, FireAnalysisView, FireImpact } from '../fire-impact/fire-impact.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries, KPICard, KpiSourceData, PieChartSlice } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  getFilterLabel
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

const PERIOD_OPTIONS: Array<{ value: FireAnalysisFilters['period']; label: string }> = [
  { value: 'TODAY', label: 'Gun' },
  { value: 'WEEK', label: 'Hafta' },
  { value: 'MONTH', label: 'Ay' },
  { value: 'YEAR', label: 'Yil' }
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

const getDepartmentOptions = (view: FireAnalysisView) => (
  Array.from(new Set(view.impacts.map(impact => impact.department).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, 'tr-TR'))
)

const getOperatorOptions = (view: FireAnalysisView) => (
  Array.from(new Set(view.impacts.map(impact => impact.operator).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second, 'tr-TR'))
)

const getImpactClass = (impact: FireImpact) => {
  if(impact.impactScore >= 80) return 'danger-pill'
  if(impact.impactScore >= 65) return 'warning-pill'
  if(impact.impactScore >= 40) return 'muted-pill'
  return 'success'
}

export default function FireImpactAnalysis({ currentUser }: { currentUser: User }){
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [filters, setFilters] = React.useState<FireAnalysisFilters>(() => createDefaultFireAnalysisFilters())
  const view = React.useMemo(() => createFireAnalysisView(sourceData, filters), [sourceData, filters])
  const [selectedImpactId, setSelectedImpactId] = React.useState('')
  const selectedImpact = view.filteredImpacts.find(impact => impact.id === selectedImpactId)
    || view.filteredImpacts[0]
    || null
  const productOptions = React.useMemo(() => getProductOptions(sourceData), [sourceData])
  const departmentOptions = React.useMemo(() => getDepartmentOptions(view), [view])
  const operatorOptions = React.useMemo(() => getOperatorOptions(view), [view])

  React.useEffect(() => {
    if(selectedImpactId && view.filteredImpacts.some(impact => impact.id === selectedImpactId)) return
    setSelectedImpactId(view.filteredImpacts[0]?.id || '')
  }, [selectedImpactId, view.filteredImpacts])

  const updateFilter = <TKey extends keyof FireAnalysisFilters>(key: TKey, value: FireAnalysisFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fire-analysis-page">
      <div className="page-header">
        <div>
          <h2>Fire Analizi</h2>
          <p className="muted">Stok hareketi olusturmadan fire kayitlarinin stok, maliyet, recete, uretim, KPI ve DSS etkisini analiz eder.</p>
        </div>
        <div className="fire-header-actions">
          <span className="status-pill success">Read Model</span>
          <span className="muted">{getUserName(currentUser)}</span>
        </div>
      </div>

      <FireCardGrid cards={view.cards} />

      <section className="card fire-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{getFilterLabel(filters)} araliginda {formatNumber(view.filteredImpacts.length)} / {formatNumber(view.impacts.length)} fire etkisi listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFireAnalysisFilters())}>Sifirla</button>
        </div>
        <div className="fire-filter-grid">
          <label className="form-field">
            <span>Donem</span>
            <select value={filters.period} onChange={event => updateFilter('period', event.target.value as FireAnalysisFilters['period'])}>
              {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
            <span>Kategori</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value as FireAnalysisFilters['category'])}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {FIRE_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Departman</span>
            <select value={filters.department} onChange={event => updateFilter('department', event.target.value)}>
              <option value={ALL_FILTER}>Tum Departmanlar</option>
              {departmentOptions.map(department => <option key={department} value={department}>{department}</option>)}
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

      <div className="fire-chart-grid">
        <LineChartCard series={view.fireTrend} />
        <LineChartCard series={view.costTrend} currency />
      </div>

      <div className="fire-insight-grid">
        <PieChartCard title="Kategori Dagilimi" slices={view.categoryDistribution} />
        <BarChartCard title="Urun Bazli Fire" rows={view.productFire} />
        <BarChartCard title="Departman Bazli Fire" rows={view.departmentFire} />
        <BarChartCard title="Lot Bazli Fire" rows={view.lotFire} />
        <BarChartCard title="Gunluk Fire" rows={view.dailyFire} />
        <BarChartCard title="Aylik Fire" rows={view.monthlyFire} />
      </div>

      <div className="product-layout fire-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Fire Etki Listesi</h3>
              <p className="muted">Her satir mevcut fire kaydindan turetilir; yeni stok veya uretim kaydi olusturmaz.</p>
            </div>
            <span className="status-pill">{formatNumber(view.statistics.highRiskImpactCount)} yuksek etki</span>
          </div>
          <div className="table-wrap fire-table-wrap">
            <table className="data-table fire-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Urun</th>
                  <th>Lot</th>
                  <th>Kategori</th>
                  <th>Miktar</th>
                  <th>Maliyet</th>
                  <th>Etki</th>
                </tr>
              </thead>
              <tbody>
                {view.filteredImpacts.length === 0 && (
                  <tr><td colSpan={7} className="empty-cell">Secili filtrelerde fire kaydi bulunamadi.</td></tr>
                )}
                {view.filteredImpacts.map(impact => (
                  <tr
                    key={impact.id}
                    className={selectedImpact?.id === impact.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => setSelectedImpactId(impact.id)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedImpactId(impact.id)
                    }}
                  >
                    <td data-label="Tarih">{formatDateTime(impact.occurredAt)}</td>
                    <td data-label="Urun"><strong>{impact.productName}</strong><span>{impact.stockItemName}</span></td>
                    <td data-label="Lot">{impact.lotNo || '-'}</td>
                    <td data-label="Kategori"><span className="status-pill">{impact.category}</span></td>
                    <td data-label="Miktar">{formatQuantity(impact.quantity, impact.unit)}</td>
                    <td data-label="Maliyet">{formatCurrency(impact.cost.totalCost, impact.cost.currency)}</td>
                    <td data-label="Etki"><span className={`status-pill ${getImpactClass(impact)}`}>{impact.impactScore}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side fire-side">
          <FireDetailPanel impact={selectedImpact} />
          <FireInsightPanel view={view} />
          <FireIntegrationPanel view={view} />
        </aside>
      </div>
    </div>
  )
}

function FireCardGrid({ cards }: { cards: KPICard[] }){
  return (
    <div className="metric-grid fire-card-grid">
      {cards.map(card => (
        <div className={`metric-card fire-card ${card.tone}`} key={card.id}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.detail}</small>
        </div>
      ))}
    </div>
  )
}

function LineChartCard({ currency = false, series }: { currency?: boolean; series: ChartSeries }){
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
            <strong>{currency ? formatCurrency(point.value) : formatNumber(point.value, 1)}</strong>
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
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

function PieChartCard({ slices, title }: { slices: PieChartSlice[]; title: string }){
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
          <p className="muted">{formatNumber(slices.length)} kategori</p>
        </div>
      </div>
      <div className="kpi-pie-layout">
        <div className="kpi-pie" style={{ background }} />
        <div className="kpi-pie-legend">
          {slices.length === 0 && <div className="empty-cell">Kayit bulunamadi.</div>}
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

function FireDetailPanel({ impact }: { impact: FireImpact | null }){
  if(!impact){
    return (
      <section className="card fire-detail-card">
        <h3>Fire Etkisi</h3>
        <p className="muted">Detay gormek icin bir fire satiri secin.</p>
      </section>
    )
  }

  return (
    <section className="card fire-detail-card">
      <div className="section-header compact">
        <div>
          <h3>{impact.productName}</h3>
          <p className="muted">{impact.reason} / {impact.category}</p>
        </div>
        <span className={`status-pill ${getImpactClass(impact)}`}>{impact.impactScore}</span>
      </div>
      <div className="fire-detail-grid">
        <div><span>Miktar</span><strong>{formatQuantity(impact.quantity, impact.unit)}</strong></div>
        <div><span>Maliyet</span><strong>{formatCurrency(impact.cost.totalCost, impact.cost.currency)}</strong></div>
        <div><span>Lot</span><strong>{impact.lotNo || '-'}</strong></div>
        <div><span>Work Order</span><strong>{impact.workOrderNo || '-'}</strong></div>
        <div><span>Operator</span><strong>{impact.operator}</strong></div>
        <div><span>Recete Sapmasi</span><strong>{formatPercent(impact.recipeVariancePercent)}</strong></div>
      </div>
      <div className="fire-impact-list">
        <div><strong>Stok Etkisi</strong><span>{impact.stockImpact}</span></div>
        <div><strong>Uretim Etkisi</strong><span>{impact.productionImpact}</span></div>
        <div><strong>Recete Etkisi</strong><span>{impact.recipeImpact}</span></div>
        <div><strong>Karlilik Etkisi</strong><span>{impact.profitabilityImpact}</span></div>
      </div>
    </section>
  )
}

function FireInsightPanel({ view }: { view: FireAnalysisView }){
  const insights = [
    ['En Cok Fire Veren Urun', view.insights.mostWastedProduct?.label || '-', view.insights.mostWastedProduct?.detail || 'Kayit yok'],
    ['En Cok Fire Veren Hat', view.insights.mostWastedLine?.label || '-', view.insights.mostWastedLine?.detail || 'Kayit yok'],
    ['En Cok Fire Veren Operator', view.insights.mostWastedOperator?.label || '-', view.insights.mostWastedOperator?.detail || 'Kayit yok'],
    ['En Cok Fire Veren Departman', view.insights.mostWastedDepartment?.label || '-', view.insights.mostWastedDepartment?.detail || 'Kayit yok'],
    ['En Yuksek Fire Maliyeti', view.insights.highestCostImpact ? view.insights.highestCostImpact.productName : '-', view.insights.highestCostImpact ? formatCurrency(view.insights.highestCostImpact.cost.totalCost, view.insights.highestCostImpact.cost.currency) : 'Kayit yok']
  ]

  return (
    <section className="card fire-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Analizler</h3>
          <p className="muted">Urun, hat, operator, departman ve maliyet liderleri.</p>
        </div>
      </div>
      <div className="fire-impact-list">
        {insights.map(([label, value, detail]) => (
          <div key={label}>
            <strong>{label}: {value}</strong>
            <span>{detail}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function FireIntegrationPanel({ view }: { view: FireAnalysisView }){
  return (
    <section className="card fire-detail-card">
      <div className="section-header compact">
        <div>
          <h3>KPI / DSS Etkisi</h3>
          <p className="muted">Fire etkisi merkezi raporlama ve karar destek tarafinda kullanilir.</p>
        </div>
      </div>
      <div className="fire-impact-list">
        <div>
          <strong>KPI</strong>
          <span>Toplam fire, fire %, maliyet, urun, lot, kategori, departman, gunluk, haftalik ve aylik fire metrikleri uretildi.</span>
        </div>
        <div>
          <strong>Decision Support</strong>
          <span>{view.statistics.fireRate > 3 || view.statistics.highRiskImpactCount > 0 ? 'Fire esigi yuksek; kok neden analizi onerisi uretilebilir.' : 'Fire oranlari izleniyor; esik asildiginda DSS onerisi uretilecek.'}</span>
        </div>
        <div>
          <strong>Read Model</strong>
          <span>Bu ekran sadece mevcut fire kayitlarini okur; stok transaction veya uretim kaydi yazmaz.</span>
        </div>
      </div>
    </section>
  )
}
