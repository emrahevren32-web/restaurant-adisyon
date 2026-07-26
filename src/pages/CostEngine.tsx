import React from 'react'
import {
  createCostEngineView,
  createDefaultCostEngineFilters
} from '../cost-engine/cost-engine.service'
import { createCostScenario } from '../cost-engine/cost-simulation.service'
import type {
  CostComponent,
  CostEngine as CostEngineRecord,
  CostEngineFilters,
  CostScenario,
  CostScenarioType
} from '../cost-engine/cost-engine.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries, KpiSourceData, PieChartSlice } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  getFilterLabel
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

const PERIOD_OPTIONS: Array<{ value: CostEngineFilters['period']; label: string }> = [
  { value: 'TODAY', label: 'Gun' },
  { value: 'WEEK', label: 'Hafta' },
  { value: 'MONTH', label: 'Ay' },
  { value: 'YEAR', label: 'Yil' }
]

const SCENARIO_OPTIONS: Array<{ value: CostScenarioType; label: string; percent: number }> = [
  { value: 'FIRE_INCREASE', label: 'Fire %5 artarsa', percent: 5 },
  { value: 'PURCHASE_INCREASE', label: 'Satin alma %10 artarsa', percent: 10 },
  { value: 'RAW_MATERIAL_PRICE_CHANGE', label: 'Hammadde fiyati degisirse', percent: 8 },
  { value: 'RECIPE_CHANGE', label: 'Recete degisirse', percent: -4 },
  { value: 'BLAST_CHILLING_INCREASE', label: 'Soklama maliyeti artarsa', percent: 12 }
]

const getUserName = (currentUser?: User) => currentUser?.fullName || currentUser?.username || 'Cost Analyst'

const uniqueOptions = (
  records: Array<{ id: string; name: string }>
) => Array.from(new Map(records.filter(record => record.id).map(record => [record.id, record.name])).entries())
  .map(([id, name]) => ({ id, name }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getProductOptions = (records: CostEngineRecord[]) => uniqueOptions(
  records.map(record => ({ id: record.productId, name: record.productName }))
)

const getCategoryOptions = (records: CostEngineRecord[]) => uniqueOptions(
  records.map(record => ({ id: record.categoryId, name: record.categoryName }))
)

const getWarehouseOptions = (records: CostEngineRecord[]) => uniqueOptions(
  records.map(record => ({ id: record.warehouseId, name: record.warehouseName }))
)

const getRecipeOptions = (records: CostEngineRecord[]) => uniqueOptions(
  records.map(record => ({ id: record.recipeId, name: record.recipeName }))
)

const getLotOptions = (sourceData: KpiSourceData) => sourceData.inventoryLots
  .map(lot => ({ id: lot.id, name: lot.lotNo }))
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getScenarioOption = (type: CostScenarioType) => (
  SCENARIO_OPTIONS.find(option => option.value === type) || SCENARIO_OPTIONS[0]
)

const getPercentClass = (value: number) => {
  if(value >= 15) return 'danger-pill'
  if(value >= 7) return 'warning-pill'
  if(value > 0) return 'muted-pill'
  return 'success'
}

export default function CostEngine({ currentUser }: { currentUser?: User }){
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [filters, setFilters] = React.useState<CostEngineFilters>(() => createDefaultCostEngineFilters())
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [scenarioType, setScenarioType] = React.useState<CostScenarioType>('FIRE_INCREASE')
  const [scenarioPercent, setScenarioPercent] = React.useState(5)
  const view = React.useMemo(() => createCostEngineView(sourceData, filters), [sourceData, filters])
  const productOptions = React.useMemo(() => getProductOptions(view.records), [view.records])
  const categoryOptions = React.useMemo(() => getCategoryOptions(view.records), [view.records])
  const warehouseOptions = React.useMemo(() => getWarehouseOptions(view.records), [view.records])
  const recipeOptions = React.useMemo(() => getRecipeOptions(view.records), [view.records])
  const lotOptions = React.useMemo(() => getLotOptions(sourceData), [sourceData])
  const selectedRecord = view.filteredRecords.find(record => record.id === selectedRecordId)
    || view.filteredRecords[0]
    || null
  const simulatedScenario = selectedRecord
    ? createCostScenario(scenarioType, selectedRecord.breakdown.components, selectedRecord.totalCost, scenarioPercent)
    : null

  React.useEffect(() => {
    if(selectedRecordId && view.filteredRecords.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(view.filteredRecords[0]?.id || '')
  }, [selectedRecordId, view.filteredRecords])

  const updateFilter = <TKey extends keyof CostEngineFilters>(key: TKey, value: CostEngineFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateScenarioType = (nextType: CostScenarioType) => {
    const option = getScenarioOption(nextType)
    setScenarioType(nextType)
    setScenarioPercent(option.percent)
  }

  return (
    <div className="cost-engine-page">
      <div className="page-header">
        <div>
          <h2>Cost Engine</h2>
          <p className="muted">Recete, hammadde, satin alma, fire, uretim, depolama ve sevkiyat verilerinden read-model maliyet analizi.</p>
        </div>
        <div className="cost-header-actions">
          <span className="status-pill success">Read Model</span>
          <span className="muted">{getUserName(currentUser)}</span>
        </div>
      </div>

      <div className="metric-grid cost-card-grid">
        {view.cards.map(card => (
          <div className={`metric-card cost-card ${card.tone}`} key={card.id}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </div>

      <section className="card cost-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{getFilterLabel(filters)} araliginda {formatNumber(view.filteredRecords.length)} / {formatNumber(view.records.length)} maliyet kaydi listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultCostEngineFilters())}>Sifirla</button>
        </div>
        <div className="cost-filter-grid">
          <label className="form-field">
            <span>Donem</span>
            <select value={filters.period} onChange={event => updateFilter('period', event.target.value as CostEngineFilters['period'])}>
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
            <span>Kategori</span>
            <select value={filters.categoryId} onChange={event => updateFilter('categoryId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {categoryOptions.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
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
            <span>Recete</span>
            <select value={filters.recipeId} onChange={event => updateFilter('recipeId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Receteler</option>
              {recipeOptions.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Lot</span>
            <select value={filters.lotId} onChange={event => updateFilter('lotId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Lotlar</option>
              {lotOptions.map(lot => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
        </div>
      </section>

      <div className="cost-chart-grid">
        <LineChartCard series={view.costTrend} />
        <PieChartCard title="Cost Breakdown" slices={view.breakdownDistribution} />
      </div>

      <div className="cost-insight-grid">
        <BarChartCard title="Kategori Bazli" rows={view.categoryCosts} />
        <BarChartCard title="Urun Bazli" rows={view.productCosts} />
        <BarChartCard title="Fire Etkisi" rows={view.fireImpactRows} />
      </div>

      <div className="product-layout cost-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Urun Maliyetleri</h3>
              <p className="muted">Hesaplama sadece mevcut verileri okur; stok hareketi, uretim kaydi veya muhasebe fisi olusturmaz.</p>
            </div>
            <span className="status-pill">{formatCurrency(view.statistics.averageCost)} ortalama</span>
          </div>
          <div className="table-wrap cost-table-wrap">
            <table className="data-table cost-table">
              <thead>
                <tr>
                  <th>Urun</th>
                  <th>Recete</th>
                  <th>Gramaj</th>
                  <th>Fire</th>
                  <th>Satin Alma</th>
                  <th>Toplam</th>
                  <th>kg</th>
                  <th>Adet</th>
                </tr>
              </thead>
              <tbody>
                {view.filteredRecords.length === 0 && (
                  <tr><td colSpan={8} className="empty-cell">Secili filtrelerde Cost Engine kaydi bulunamadi.</td></tr>
                )}
                {view.filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    className={selectedRecord?.id === record.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => setSelectedRecordId(record.id)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedRecordId(record.id)
                    }}
                  >
                    <td data-label="Urun"><strong>{record.productName}</strong><span>{record.categoryName}</span></td>
                    <td data-label="Recete"><strong>{record.recipeCode}</strong><span>{record.recipeName}</span></td>
                    <td data-label="Gramaj">{formatQuantity(record.totalGram, 'gr')}</td>
                    <td data-label="Fire"><span className={`status-pill ${getPercentClass(record.breakdown.firePercent)}`}>{formatCurrency(record.fireImpact)}</span></td>
                    <td data-label="Satin Alma">{formatCurrency(record.purchaseImpact)}</td>
                    <td data-label="Toplam"><strong>{formatCurrency(record.totalCost)}</strong></td>
                    <td data-label="kg">{formatCurrency(record.costPerKg)}</td>
                    <td data-label="Adet">{formatCurrency(record.costPerUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side cost-side">
          <CostDetailPanel record={selectedRecord} />
          <CostBreakdownPanel components={selectedRecord?.breakdown.components || []} />
          <CostSimulationPanel
            record={selectedRecord}
            scenario={simulatedScenario}
            scenarioPercent={scenarioPercent}
            scenarioType={scenarioType}
            onScenarioPercentChange={setScenarioPercent}
            onScenarioTypeChange={updateScenarioType}
          />
          <CostIntegrationPanel record={selectedRecord} />
        </aside>
      </div>
    </div>
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
            <strong>{formatCurrency(point.value)}</strong>
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
          <p className="muted">{formatNumber(slices.length)} bilesen</p>
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

function CostDetailPanel({ record }: { record: CostEngineRecord | null }){
  if(!record){
    return (
      <section className="card cost-detail-card">
        <h3>Urun Detayi</h3>
        <p className="muted">Detay gormek icin bir urun secin.</p>
      </section>
    )
  }

  return (
    <section className="card cost-detail-card">
      <div className="section-header compact">
        <div>
          <h3>{record.productName}</h3>
          <p className="muted">{record.recipeName} / {record.lotNo || 'Lot yok'}</p>
        </div>
        <span className="status-pill">{record.productType}</span>
      </div>
      <div className="cost-detail-grid">
        <div><span>Toplam Gramaj</span><strong>{formatQuantity(record.totalGram, 'gr')}</strong></div>
        <div><span>Toplam Maliyet</span><strong>{formatCurrency(record.totalCost)}</strong></div>
        <div><span>Maliyet / kg</span><strong>{formatCurrency(record.costPerKg)}</strong></div>
        <div><span>Maliyet / adet</span><strong>{formatCurrency(record.costPerUnit)}</strong></div>
        <div><span>Fire Etkisi</span><strong>{formatCurrency(record.fireImpact)}</strong></div>
        <div><span>Satin Alma Etkisi</span><strong>{formatCurrency(record.purchaseImpact)}</strong></div>
      </div>
      <div className="cost-impact-list">
        <div><strong>Gercek Maliyet</strong><span>{formatCurrency(record.actualCost)}</span></div>
        <div><strong>Tahmini Maliyet</strong><span>{formatCurrency(record.estimatedCost)}</span></div>
        <div><strong>Standart Maliyet</strong><span>{formatCurrency(record.standardCost)}</span></div>
        <div><strong>Ortalama / Min / Max</strong><span>{formatCurrency(record.averageCost)} / {formatCurrency(record.minCost)} / {formatCurrency(record.maxCost)}</span></div>
      </div>
    </section>
  )
}

function CostBreakdownPanel({ components }: { components: CostComponent[] }){
  const maxValue = Math.max(1, ...components.map(component => component.amount))

  return (
    <section className="card cost-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Cost Breakdown</h3>
          <p className="muted">Hammadde, iscilik, fire, ambalaj, depolama, sevkiyat ve diger paylari.</p>
        </div>
      </div>
      <div className="cost-component-list">
        {components.map(component => (
          <div className="cost-component-row" key={component.id}>
            <div>
              <strong>{component.label}</strong>
              <span>{component.source} / {formatPercent(component.percent)}</span>
            </div>
            <div className="kpi-bar-track">
              <span style={{ width: `${Math.max(3, (component.amount / maxValue) * 100)}%` }} />
            </div>
            <em>{formatCurrency(component.amount)}</em>
          </div>
        ))}
      </div>
    </section>
  )
}

function CostSimulationPanel({
  onScenarioPercentChange,
  onScenarioTypeChange,
  record,
  scenario,
  scenarioPercent,
  scenarioType
}: {
  onScenarioPercentChange: (value: number) => void
  onScenarioTypeChange: (value: CostScenarioType) => void
  record: CostEngineRecord | null
  scenario: CostScenario | null
  scenarioPercent: number
  scenarioType: CostScenarioType
}){
  return (
    <section className="card cost-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Cost Simulation</h3>
          <p className="muted">Senaryo mevcut kaydin kopyasi uzerinde hesaplanir; veri yazmaz.</p>
        </div>
      </div>
      <div className="cost-simulation-controls">
        <label className="form-field">
          <span>Senaryo</span>
          <select value={scenarioType} onChange={event => onScenarioTypeChange(event.target.value as CostScenarioType)}>
            {SCENARIO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Degisim %</span>
          <input type="number" min="-50" max="100" step="1" value={scenarioPercent} onChange={event => onScenarioPercentChange(Number(event.target.value))} />
        </label>
      </div>
      {!record || !scenario ? (
        <p className="muted">Simulasyon icin bir urun secin.</p>
      ) : (
        <div className="cost-impact-list">
          <div><strong>Temel Maliyet</strong><span>{formatCurrency(scenario.baseCost)}</span></div>
          <div><strong>Simule Maliyet</strong><span>{formatCurrency(scenario.simulatedCost)}</span></div>
          <div><strong>Fark</strong><span>{formatCurrency(scenario.deltaAmount)} / {formatPercent(scenario.deltaPercent)}</span></div>
          <div><strong>Etkilenen Bilesen</strong><span>{scenario.affectedComponentTypes.join(', ')}</span></div>
        </div>
      )}
    </section>
  )
}

function CostIntegrationPanel({ record }: { record: CostEngineRecord | null }){
  const fireWarning = record && record.breakdown.firePercent >= 7
  const purchaseWarning = record && record.breakdown.purchasePercent >= 12

  return (
    <section className="card cost-detail-card">
      <div className="section-header compact">
        <div>
          <h3>KPI / Decision Support</h3>
          <p className="muted">Cost Engine read-model ciktisi raporlama ve oneri motoruna aktarilir.</p>
        </div>
      </div>
      <div className="cost-impact-list">
        <div>
          <strong>KPI</strong>
          <span>Toplam maliyet, ortalama kg maliyeti, fire etkisi, satin alma etkisi ve trend KPI kartlarina beslenir.</span>
        </div>
        <div>
          <strong>Decision Support</strong>
          <span>{fireWarning ? 'Fire nedeniyle maliyet %7 uzeri; recete veya proses revizyon onerisi uretilebilir.' : purchaseWarning ? 'Satin alma etkisi yuksek; hammadde fiyat artisi onerisi uretilebilir.' : 'Esikler izleniyor; maliyet sapmasi artarsa DSS onerisi uretilir.'}</span>
        </div>
        <div>
          <strong>Read Model</strong>
          <span>Yeni stok hareketi, uretim kaydi veya muhasebe fisi olusturulmaz.</span>
        </div>
      </div>
    </section>
  )
}
