import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { createDefaultDecisionSupportFilters, createDecisionSupportView } from '../decision-support/decision-support.service'
import type {
  DecisionCategory,
  DecisionPriority,
  DecisionRisk,
  DecisionSuggestion,
  DecisionSupportFilters
} from '../decision-support/decision-support.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber
} from '../kpi-reporting/kpi.utils'
import type { User } from '../types'

const CATEGORY_OPTIONS: DecisionCategory[] = ['Production', 'Inventory', 'Quality', 'Purchasing', 'Shipment', 'Management']
const RISK_OPTIONS: DecisionRisk[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const PRIORITY_OPTIONS: DecisionPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

type DecisionOutputRow = {
  suggestion: DecisionSuggestion
  relatedEntity: string
}

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

const getRiskClass = (risk: DecisionRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getPriorityClass = (priority: DecisionPriority) => {
  if(priority === 'URGENT') return 'danger-pill'
  if(priority === 'HIGH') return 'warning-pill'
  if(priority === 'NORMAL') return 'muted-pill'
  return 'success'
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

const getWorkOrderOptions = (sourceData: KpiSourceData) => [
  ...sourceData.productionOrders.map(order => ({ id: order.id, label: order.workOrderNo })),
  ...sourceData.shipmentWorkOrders.map(order => ({ id: order.id, label: order.workOrderNo }))
].sort((first, second) => first.label.localeCompare(second.label, 'tr-TR'))

const getRelatedEntityLabel = (
  suggestion: DecisionSuggestion,
  sourceData: KpiSourceData
) => {
  if(suggestion.relatedEntityType === 'ProductionWorkOrder'){
    return sourceData.productionOrders.find(order => order.id === suggestion.relatedEntityId)?.workOrderNo || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'InventoryLot'){
    return sourceData.inventoryLots.find(lot => lot.id === suggestion.relatedEntityId)?.lotNo || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'StockItem'){
    return sourceData.stockItems.find(item => item.id === suggestion.relatedEntityId)?.name || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'StockWasteRecord'){
    const record = sourceData.stockWasteRecords.find(item => item.id === suggestion.relatedEntityId)
    return record ? `${record.stockItemName} / ${record.reasonCategory}` : suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'CostEngine'){
    return sourceData.productRefs.find(product => product.id === suggestion.relatedProductId)?.name
      || suggestion.relatedProductId
      || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'Supplier'){
    return sourceData.suppliers.find(supplier => supplier.id === suggestion.relatedEntityId)?.name || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'ShipmentPlan'){
    return sourceData.shipmentPlans.find(plan => plan.id === suggestion.relatedEntityId)?.shipmentPlanNo || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'ShipmentVehicle'){
    return sourceData.shipmentVehicles.find(vehicle => vehicle.id === suggestion.relatedEntityId)?.vehicleNo || suggestion.relatedEntityId
  }
  if(suggestion.relatedEntityType === 'CriticalControlPoint'){
    const ccp = sourceData.haccpRecords.flatMap(plan => plan.criticalControlPoints).find(record => record.id === suggestion.relatedEntityId)
    return ccp?.name || suggestion.relatedEntityId
  }
  return suggestion.relatedEntityId
}

const escapeHtml = (value: string | number) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const createOutputRows = (
  suggestions: DecisionSuggestion[],
  sourceData: KpiSourceData
): DecisionOutputRow[] => suggestions.map(suggestion => ({
  suggestion,
  relatedEntity: getRelatedEntityLabel(suggestion, sourceData)
}))

const mapRowsForOutput = (
  rows: DecisionOutputRow[]
) => rows.map(row => ({
  'Kategori': row.suggestion.category,
  'Oneri': row.suggestion.title,
  'Aciklama': row.suggestion.description,
  'Risk': row.suggestion.risk,
  'Risk Skoru': row.suggestion.riskScore,
  'Oncelik': row.suggestion.priority,
  'Ilgili Kayit': row.relatedEntity,
  'Sebep': row.suggestion.reason,
  'Onerilen Aksiyon': row.suggestion.recommendation.action,
  'Beklenen Etki': row.suggestion.recommendation.expectedImpact,
  'Sorumlu Rol': row.suggestion.recommendation.ownerRole,
  'Olusturma': formatDateTime(row.suggestion.createdAt)
}))

const createFilteredOutputFileName = () => `karar-destek-filtreli-${new Date().toLocaleDateString('sv-SE')}.xlsx`

const exportFilteredRowsToExcel = (
  rows: DecisionOutputRow[]
) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'recommendation-engine',
    moduleLabel: 'Karar Destek',
    sheetName: 'Filtreli Liste',
    fileNamePrefix: 'karar-destek-filtreli',
    fileName: createFilteredOutputFileName(),
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const createFilteredPrintHtml = (
  rows: DecisionOutputRow[],
  mode: 'A4' | 'PDF'
) => `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Karar Destek Filtreli Liste</title>
  <style>
    body { font-family: Arial, sans-serif; color: ${PRINT_THEME_COLORS.text}; margin: ${PRINT_SPACING_VALUES.space24}; }
    h1 { margin: 0 0 ${PRINT_SPACING_VALUES.space4}; font-size: 22px; }
    .muted { color: ${PRINT_THEME_COLORS.textMuted}; font-size: 12px; }
    .pill { display: inline-block; margin: ${PRINT_SPACING_VALUES.space12} 0; padding: ${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; border: 1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius: 999px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid ${PRINT_THEME_COLORS.borderSoft}; padding: ${PRINT_SPACING_VALUES.space8}; text-align: left; vertical-align: top; }
    th { background: ${PRINT_THEME_COLORS.pageBackground}; color: ${PRINT_THEME_COLORS.textHeader}; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <h1>Karar Destek Filtreli Liste</h1>
  <div class="muted">${escapeHtml(formatDateTime(new Date().toISOString()))}</div>
  <span class="pill">${escapeHtml(mode === 'PDF' ? 'PDF Hazirlik' : `${rows.length} oneri`)}</span>
  <table>
    <thead>
      <tr>
        <th>Kategori</th>
        <th>Oneri</th>
        <th>Risk</th>
        <th>Oncelik</th>
        <th>Ilgili Kayit</th>
        <th>Aksiyon</th>
        <th>Olusturma</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(row => `
        <tr>
          <td>${escapeHtml(row.suggestion.category)}</td>
          <td>${escapeHtml(row.suggestion.title)}<br><span class="muted">${escapeHtml(row.suggestion.description)}</span></td>
          <td>${escapeHtml(`${row.suggestion.risk} / ${row.suggestion.riskScore}`)}</td>
          <td>${escapeHtml(row.suggestion.priority)}</td>
          <td>${escapeHtml(row.relatedEntity)}</td>
          <td>${escapeHtml(row.suggestion.recommendation.action)}</td>
          <td>${escapeHtml(formatDateTime(row.suggestion.createdAt))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <script>window.addEventListener('load', () => window.print())</script>
</body>
</html>`

const openFilteredPrintWindow = (
  rows: DecisionOutputRow[],
  mode: 'A4' | 'PDF'
) => {
  const printWindow = window.open('', '_blank', 'width=1180,height=840')
  if(!printWindow) throw new Error('Cikti penceresi acilamadi.')
  printWindow.document.open()
  printWindow.document.write(createFilteredPrintHtml(rows, mode))
  printWindow.document.close()
}

export default function DecisionSupport({ currentUser }: { currentUser: User }){
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [filters, setFilters] = React.useState<DecisionSupportFilters>(() => createDefaultDecisionSupportFilters())
  const [outputMessage, setOutputMessage] = React.useState('')
  const view = React.useMemo(() => createDecisionSupportView(sourceData, filters), [sourceData, filters])
  const [selectedSuggestionId, setSelectedSuggestionId] = React.useState('')
  const productOptions = React.useMemo(() => getProductOptions(sourceData), [sourceData])
  const warehouseOptions = React.useMemo(() => getWarehouseOptions(sourceData), [sourceData])
  const workOrderOptions = React.useMemo(() => getWorkOrderOptions(sourceData), [sourceData])
  const selectedSuggestion = view.filteredSuggestions.find(suggestion => suggestion.id === selectedSuggestionId)
    || view.filteredSuggestions[0]
    || null

  React.useEffect(() => {
    if(selectedSuggestionId && view.filteredSuggestions.some(suggestion => suggestion.id === selectedSuggestionId)) return
    setSelectedSuggestionId(view.filteredSuggestions[0]?.id || '')
  }, [selectedSuggestionId, view.filteredSuggestions])

  const updateFilter = <TKey extends keyof DecisionSupportFilters>(key: TKey, value: DecisionSupportFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const outputFilteredRows = (action: 'PRINTED' | 'PDF' | 'EXCEL') => {
    const rows = createOutputRows(view.filteredSuggestions, sourceData)
    try {
      if(action === 'EXCEL') exportFilteredRowsToExcel(rows)
      if(action === 'PRINTED') openFilteredPrintWindow(rows, 'A4')
      if(action === 'PDF') openFilteredPrintWindow(rows, 'PDF')
      setOutputMessage(
        action === 'EXCEL'
          ? `${formatNumber(rows.length)} satirlik filtreli liste Excel ciktisina aktarildi.`
          : `${formatNumber(rows.length)} satirlik filtreli liste cikti penceresinde acildi.`
      )
    } catch (error) {
      setOutputMessage(error instanceof Error ? error.message : 'Cikti islemi tamamlanamadi.')
    }
  }

  return (
    <div className="decision-support-page">
      <div className="page-header">
        <div>
          <h2>Karar Destek Merkezi</h2>
          <p className="muted">ERP verilerini analiz modeli olarak işleyen kural, risk ve öneri motoru.</p>
        </div>
        <div className="decision-header-actions">
          <span className="status-pill success">Analiz Modeli</span>
          <span className="muted">{getUserName(currentUser)}</span>
        </div>
      </div>

      <DecisionDashboardCards view={view} />

      <section className="card decision-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(view.filteredSuggestions.length)} / {formatNumber(view.suggestions.length)} oneriyi gosteriyor.</p>
          </div>
          <div className="decision-filter-actions">
            <button className="btn" type="button" onClick={() => outputFilteredRows('EXCEL')}>Filtreli Excel</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PDF')}>Filtreli PDF</button>
            <button className="btn" type="button" onClick={() => outputFilteredRows('PRINTED')}>Filtreli Yazdir</button>
            <button className="btn" type="button" onClick={() => setFilters(createDefaultDecisionSupportFilters())}>Sifirla</button>
          </div>
        </div>
        {outputMessage && <p className="form-success">{outputMessage}</p>}
        <div className="decision-filter-grid">
          <label className="form-field">
            <span>Kategori</span>
            <select value={filters.category} onChange={event => updateFilter('category', event.target.value as DecisionSupportFilters['category'])}>
              <option value={ALL_FILTER}>Tum Kategoriler</option>
              {CATEGORY_OPTIONS.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as DecisionSupportFilters['risk'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {RISK_OPTIONS.map(risk => <option key={risk} value={risk}>{risk}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Oncelik</span>
            <select value={filters.priority} onChange={event => updateFilter('priority', event.target.value as DecisionSupportFilters['priority'])}>
              <option value={ALL_FILTER}>Tum Oncelikler</option>
              {PRIORITY_OPTIONS.map(priority => <option key={priority} value={priority}>{priority}</option>)}
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
            <span>Tedarikçi</span>
            <select value={filters.supplierId} onChange={event => updateFilter('supplierId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Tedarikçiler</option>
              {sourceData.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>İş Emri</span>
            <select value={filters.workOrderId} onChange={event => updateFilter('workOrderId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm İş Emirleri</option>
              {workOrderOptions.map(order => <option key={order.id} value={order.id}>{order.label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
        </div>
      </section>

      <div className="product-layout decision-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Karar Önerileri</h3>
              <p className="muted">Kural motoru tarafından üretilen öneriler. Operasyon otomatik başlatılmaz.</p>
            </div>
          </div>
          <div className="table-wrap decision-table-wrap">
            <table className="data-table decision-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Oneri</th>
                  <th>Risk</th>
                  <th>Oncelik</th>
                  <th>İlgili Kayıt</th>
                  <th>Oluşturma</th>
                </tr>
              </thead>
              <tbody>
                {view.filteredSuggestions.length === 0 && (
                  <tr><td colSpan={6} className="empty-cell">Oneri bulunamadi.</td></tr>
                )}
                {view.filteredSuggestions.map(suggestion => (
                  <tr
                    key={suggestion.id}
                    className={selectedSuggestion?.id === suggestion.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => setSelectedSuggestionId(suggestion.id)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedSuggestionId(suggestion.id)
                    }}
                  >
                    <td data-label="Kategori"><span className="status-pill">{suggestion.category}</span></td>
                    <td data-label="Oneri"><strong>{suggestion.title}</strong><span>{suggestion.description}</span></td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(suggestion.risk)}`}>{suggestion.risk} / {suggestion.riskScore}</span></td>
                    <td data-label="Oncelik"><span className={`status-pill ${getPriorityClass(suggestion.priority)}`}>{suggestion.priority}</span></td>
                    <td data-label="İlgili Kayıt">{getRelatedEntityLabel(suggestion, sourceData)}</td>
                    <td data-label="Olusturma">{formatDateTime(suggestion.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side decision-side">
          <DecisionDetailPanel suggestion={selectedSuggestion} sourceData={sourceData} />
          <RuleEnginePanel view={view} />
          <RiskEnginePanel suggestions={view.filteredSuggestions} />
        </aside>
      </div>
    </div>
  )
}

function DecisionDashboardCards({ view }: { view: ReturnType<typeof createDecisionSupportView> }){
  const cards = [
    ['Bugunku Oneriler', view.dashboard.todaySuggestions, 'neutral'],
    ['Kritik Riskler', view.dashboard.criticalRisks, view.dashboard.criticalRisks > 0 ? 'danger' : 'success'],
    ['Bekleyen Corrective Action', view.dashboard.pendingCorrectiveActions, view.dashboard.pendingCorrectiveActions > 0 ? 'warning' : 'success'],
    ['Kritik Stoklar', view.dashboard.criticalStocks, view.dashboard.criticalStocks > 0 ? 'danger' : 'success'],
    ['Yuksek Fire', view.dashboard.highFire, view.dashboard.highFire > 0 ? 'warning' : 'success'],
    ['Riskli Tedarikçi', view.dashboard.riskySuppliers, view.dashboard.riskySuppliers > 0 ? 'warning' : 'success'],
    ['Riskli CCP', view.dashboard.riskyCcps, view.dashboard.riskyCcps > 0 ? 'danger' : 'success'],
    ['Geciken Uretim', view.dashboard.delayedProduction, view.dashboard.delayedProduction > 0 ? 'warning' : 'success'],
    ['Geciken Sevkiyat', view.dashboard.delayedShipments, view.dashboard.delayedShipments > 0 ? 'warning' : 'success']
  ] as const

  return (
    <div className="metric-grid decision-metrics">
      {cards.map(([label, value, tone]) => (
        <div className={`metric-card decision-metric ${tone}`} key={label}>
          <span>{label}</span>
          <strong>{formatNumber(value)}</strong>
        </div>
      ))}
    </div>
  )
}

function DecisionDetailPanel({
  sourceData,
  suggestion
}: {
  sourceData: KpiSourceData
  suggestion: DecisionSuggestion | null
}){
  if(!suggestion){
    return (
      <section className="card decision-detail-card">
        <h3>Oneri Detayi</h3>
        <p className="muted">Detay gormek icin bir DSS onerisi secin.</p>
      </section>
    )
  }

  return (
    <section className="card decision-detail-card">
      <div className="section-header compact">
        <div>
          <h3>{suggestion.title}</h3>
          <p className="muted">{suggestion.ruleId}</p>
        </div>
        <span className={`status-pill ${getRiskClass(suggestion.risk)}`}>{suggestion.riskScore}</span>
      </div>
      <div className="decision-detail-grid">
        <div><span>Kategori</span><strong>{suggestion.category}</strong></div>
        <div><span>Risk</span><strong>{suggestion.risk}</strong></div>
        <div><span>Oncelik</span><strong>{suggestion.priority}</strong></div>
        <div><span>Status</span><strong>{suggestion.status}</strong></div>
        <div><span>İlgili Kayıt</span><strong>{getRelatedEntityLabel(suggestion, sourceData)}</strong></div>
        <div><span>Owner</span><strong>{suggestion.recommendation.ownerRole}</strong></div>
      </div>
      <div className="decision-explain-list">
        <div>
          <strong>Sebep</strong>
          <span>{suggestion.reason}</span>
        </div>
        <div>
          <strong>Onerilen Aksiyon</strong>
          <span>{suggestion.recommendation.action}</span>
        </div>
        <div>
          <strong>Beklenen Etki</strong>
          <span>{suggestion.recommendation.expectedImpact}</span>
        </div>
      </div>
    </section>
  )
}

function RuleEnginePanel({ view }: { view: ReturnType<typeof createDecisionSupportView> }){
  return (
    <section className="card decision-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Kural Motoru</h3>
          <p className="muted">AI Engine icin degistirilebilir kural katalogu.</p>
        </div>
        <span className="status-pill">{formatNumber(view.rules.length)} rule</span>
      </div>
      <div className="decision-rule-list">
        {view.rules.slice(0, 8).map(rule => (
          <div className="decision-rule-row" key={rule.id}>
            <strong>{rule.title}</strong>
            <span>{rule.thresholdLabel}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RiskEnginePanel({ suggestions }: { suggestions: DecisionSuggestion[] }){
  const riskBuckets = RISK_OPTIONS.map(risk => ({
    risk,
    count: suggestions.filter(suggestion => suggestion.risk === risk).length
  }))

  return (
    <section className="card decision-detail-card">
      <div className="section-header compact">
        <div>
          <h3>Risk Engine</h3>
          <p className="muted">Risk score, rule base risk ve evidence score ile hesaplanir.</p>
        </div>
      </div>
      <div className="decision-risk-list">
        {riskBuckets.map(bucket => (
          <div className="decision-risk-row" key={bucket.risk}>
            <span className={`status-pill ${getRiskClass(bucket.risk)}`}>{bucket.risk}</span>
            <strong>{formatNumber(bucket.count)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}
