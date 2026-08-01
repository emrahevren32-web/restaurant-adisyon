import React from 'react'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { ForecastPrintService } from '../forecasting/forecast-print.service'
import {
  FORECAST_ANALYSIS_WINDOW_OPTIONS,
  FORECAST_HORIZON_OPTIONS,
  FORECAST_RISK_LABELS,
  FORECAST_RISK_LEVELS,
  FORECAST_STATUS_LABELS,
  FORECAST_TREND_LABELS,
  FORECAST_TYPE_LABELS,
  FORECAST_TYPES,
  ForecastService
} from '../forecasting/forecast.service'
import type {
  ForecastFilters,
  ForecastHistoryAction,
  ForecastPrediction,
  ForecastReport,
  ForecastReportCreateInput,
  ForecastRiskLevel,
  ForecastStatus,
  ForecastTrendDirection
} from '../forecasting/forecasting.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  formatPercent,
  formatQuantity
} from '../kpi-reporting/kpi.utils'
import { getDecisionSourceModuleLabel } from '../decision-support/decision-support-ui.utils'
import { loadEmployees } from '../storage'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type ForecastRow = {
  report: ForecastReport
  prediction: ForecastPrediction
}

const getUserName = (currentUser: User) => currentUser.fullName || currentUser.username

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
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

const getRiskClass = (risk: ForecastRiskLevel) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getTrendClass = (trend: ForecastTrendDirection) => {
  if(trend === 'UP') return 'warning-pill'
  if(trend === 'DOWN') return 'success'
  if(trend === 'SEASONAL') return 'muted-pill'
  return 'success'
}

const getStatusClass = (status: ForecastStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: ForecastHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'CALCULATED') return 'Hesaplandi'
  if(action === 'REVIEWED') return 'Incelendi'
  if(action === 'ARCHIVED') return 'Arsivlendi'
  if(action === 'PRINTED') return 'Yazdirildi'
  if(action === 'PDF') return 'PDF'
  return 'Excel'
}

const uniqueOptions = (
  options: Array<{ id: string; name: string }>
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const getActionDisabled = (
  report: ForecastReport | null,
  status: Extract<ForecastStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

export default function Forecasting({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<ForecastReport[]>(() => ForecastService.list(sourceData))
  const [filters, setFilters] = React.useState<ForecastFilters>(() => ForecastService.createDefaultFilters())
  const [selectedPredictionId, setSelectedPredictionId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<ForecastReportCreateInput>(() => ForecastService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => ForecastService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<ForecastRow[]>(() => (
    filteredReports.flatMap(report => report.predictions.map(prediction => ({ report, prediction })))
  ), [filteredReports])
  const statistics = React.useMemo(() => ForecastService.statistics(reports), [reports])
  const selectedRow = rows.find(row => row.prediction.id === selectedPredictionId)
    || rows[0]
    || null
  const selectedReport = selectedRow
    ? reports.find(report => report.id === selectedRow.report.id) || selectedRow.report
    : reports[0] || null
  const branchOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...reports.flatMap(report => report.predictions.map(prediction => ({ id: prediction.branchId, name: prediction.branchName || prediction.branchId })))
  ]), [reports, sourceData])
  const productOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productRefs.map(product => ({ id: product.id, name: product.name })),
    ...sourceData.stockItems.map(item => ({ id: item.id, name: item.name })),
    ...reports.flatMap(report => report.predictions.map(prediction => ({
      id: prediction.productId || prediction.stockItemId,
      name: prediction.productName || prediction.stockItemName
    })))
  ]), [reports, sourceData])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...reports.flatMap(report => report.predictions.map(prediction => ({ id: prediction.productionLineId, name: prediction.productionLineName })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.predictions.map(prediction => ({
    id: prediction.machineId,
    name: `${prediction.machineCode || prediction.machineId} / ${prediction.machineName || prediction.entityName}`
  })))), [reports])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...reports.flatMap(report => report.predictions.map(prediction => ({ id: prediction.employeeId, name: prediction.employeeName || prediction.employeeId })))
  ]), [reports])

  React.useEffect(() => {
    if(selectedPredictionId && rows.some(row => row.prediction.id === selectedPredictionId)) return
    setSelectedPredictionId(rows[0]?.prediction.id || '')
  }, [rows, selectedPredictionId])

  const refreshReports = (targetPredictionId?: string) => {
    const nextReports = ForecastService.list(sourceData)
    setReports(nextReports)
    if(targetPredictionId) setSelectedPredictionId(targetPredictionId)
  }

  const updateFilter = <TKey extends keyof ForecastFilters>(key: TKey, value: ForecastFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof ForecastReportCreateInput>(key: TKey, value: ForecastReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = ForecastService.add(form, sourceData, userName)
      const firstPredictionId = report.predictions[0]?.id || ''
      refreshReports(firstPredictionId)
      setForm(ForecastService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} tahmin raporu oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Tahmin raporu oluşturulamadı.' })
    }
  }

  const changeStatus = (status: Extract<ForecastStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = ForecastService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.predictions[0]?.id || selectedPredictionId)
      setMessage({ type: 'success', text: `${report.reportNo} ${FORECAST_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Tahmin durumu güncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<ForecastHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') ForecastPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') ForecastPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['forecasting'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = ForecastService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.predictions[0]?.id || selectedPredictionId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel export edildi.`
          : `${report.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Tahmin çıktısı alınamadı.' })
    }
  }

  return (
    <div className="forecasting-page">
      <div className="page-header">
        <div>
          <h2>Tahminleme</h2>
          <p className="muted">Geçmiş üretim, stok, satın alma, sevkiyat, fire, kalite, personel, kapasite ve kritik alarm verilerinden analiz modeli tahmin üretir.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid forecasting-metric-grid">
        <div className="metric-card">
          <span>Tahminler</span>
          <strong>{formatNumber(statistics.totalForecasts)}</strong>
          <small>{formatNumber(rows.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Riskli Tahminler</span>
          <strong>{formatNumber(statistics.riskyForecasts)}</strong>
          <small>HIGH / CRITICAL</small>
        </div>
        <div className="metric-card warning">
          <span>En Buyuk Artis</span>
          <strong>{statistics.biggestIncreaseLabel}</strong>
          <small>Trend analizi</small>
        </div>
        <div className="metric-card success">
          <span>En Buyuk Dusus</span>
          <strong>{statistics.biggestDecreaseLabel}</strong>
          <small>Trend analizi</small>
        </div>
        <div className="metric-card">
          <span>Güven Skoru</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Ortalama tahmin guveni</small>
        </div>
      </div>

      <section className="card forecasting-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni Tahmin Raporu</h3>
            <p className="muted">Sadece tahmin raporu olusturur; siparis, uretim emri, stok veya vardiya kaydi olusturmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
        </div>
        <div className="forecasting-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Tahmin Ufku</span>
            <select value={form.horizonDays} onChange={event => updateForm('horizonDays', Number(event.target.value))}>
              {FORECAST_HORIZON_OPTIONS.map(days => <option key={days} value={days}>{days} gun</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Analiz Penceresi</span>
            <select value={form.analysisWindowDays} onChange={event => updateForm('analysisWindowDays', Number(event.target.value))}>
              {FORECAST_ANALYSIS_WINDOW_OPTIONS.map(days => <option key={days} value={days}>{days} gun</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Senaryo</span>
            <input value={form.scenarioName} onChange={event => updateForm('scenarioName', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field forecasting-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="Tahmin analiz notu" />
          </label>
        </div>
      </section>

      <section className="card forecasting-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} tahmin listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(ForecastService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="forecasting-filter-grid">
          <label className="form-field">
            <span>Tahmin Turu</span>
            <select value={filters.forecastType} onChange={event => updateFilter('forecastType', event.target.value as ForecastFilters['forecastType'])}>
              <option value={ALL_FILTER}>Tum Turler</option>
              {FORECAST_TYPES.map(type => <option key={type} value={type}>{FORECAST_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.riskLevel} onChange={event => updateFilter('riskLevel', event.target.value as ForecastFilters['riskLevel'])}>
              <option value={ALL_FILTER}>Tum Riskler</option>
              {FORECAST_RISK_LEVELS.map(risk => <option key={risk} value={risk}>{FORECAST_RISK_LABELS[risk]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Subeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Urun / Stok</span>
            <select value={filters.productId} onChange={event => updateFilter('productId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Urunler</option>
              {productOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Hat</span>
            <select value={filters.productionLineId} onChange={event => updateFilter('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Hatlar</option>
              {lineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Makine</span>
            <select value={filters.machineId} onChange={event => updateFilter('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Makineler</option>
              {machineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Personel</span>
            <select value={filters.employeeId} onChange={event => updateFilter('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tum Personel</option>
              {employeeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field forecasting-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, ürün, stok, hat, makine, tedarikçi, öneri" />
          </label>
        </div>
      </section>

      <div className="forecasting-chart-grid">
        <BarChartCard title="Tahmin Turu" rows={statistics.typeRows} />
        <BarChartCard title="Risk Bazli" rows={statistics.riskRows} />
        <BarChartCard title="Urun Bazli" rows={statistics.productRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <BarChartCard title="Kategori Bazli" rows={statistics.categoryRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout forecasting-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Tahmin Listesi</h3>
              <p className="muted">Tahminler operasyonel aksiyon oluşturmaz; Karar Destek Merkezi ve KPI için analiz verisi sağlar.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.riskyForecasts)} riskli</span>
          </div>
          <div className="table-wrap forecasting-table-wrap">
            <table className="data-table forecasting-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Tur</th>
                  <th>Varlik</th>
                  <th>Beklenen</th>
                  <th>Trend</th>
                  <th>Güven Skoru</th>
                  <th>Risk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun tahmin bulunamadı.</td></tr>
                )}
                {rows.map(row => (
                  <tr
                    key={row.prediction.id}
                    aria-selected={selectedRow?.prediction.id === row.prediction.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedPredictionId(row.prediction.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedPredictionId(row.prediction.id)
                    }}
                  >
                    <td data-label="Rapor"><strong>{row.report.reportNo}</strong><span>{formatDate(row.report.reportDate)} / {row.report.horizonDays} gun</span></td>
                    <td data-label="Tur"><strong>{FORECAST_TYPE_LABELS[row.prediction.forecastType]}</strong><span>{getDecisionSourceModuleLabel(row.prediction.sourceModule)}</span></td>
                    <td data-label="Varlik"><strong>{row.prediction.entityName}</strong><span>{row.prediction.productName || row.prediction.stockItemName || row.prediction.branchName || '-'}</span></td>
                    <td data-label="Beklenen">{formatQuantity(row.prediction.expectedValue, row.prediction.unit)}</td>
                    <td data-label="Trend"><span className={`status-pill ${getTrendClass(row.prediction.trendDirection)}`}>{FORECAST_TREND_LABELS[row.prediction.trendDirection]} {formatPercent(row.prediction.growthPercent)}</span></td>
                    <td data-label="Güven Skoru">{formatNumber(row.prediction.confidenceScore, 1)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(row.prediction.riskLevel)}`}>{FORECAST_RISK_LABELS[row.prediction.riskLevel]}</span></td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.report.status)}`}>{FORECAST_STATUS_LABELS[row.report.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side forecasting-side">
          {selectedRow && selectedReport ? (
            <ForecastDetailPanel
              prediction={selectedRow.prediction}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card forecasting-detail-card">
              <h3>Tahmin Detayı</h3>
              <p className="muted">Detay görmek için bir tahmin satırı seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ForecastDetailPanel({
  onOutput,
  onStatusChange,
  prediction,
  report
}: {
  onOutput: (action: Extract<ForecastHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<ForecastStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  prediction: ForecastPrediction
  report: ForecastReport
}){
  return (
    <>
      <section className="card forecasting-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{FORECAST_TYPE_LABELS[prediction.forecastType]} / {prediction.entityName}</p>
          </div>
          <span className={`status-pill ${getRiskClass(prediction.riskLevel)}`}>{FORECAST_RISK_LABELS[prediction.riskLevel]}</span>
        </div>

        <div className="forecasting-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="forecasting-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arsivle</button>
        </div>

        <div className="forecasting-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Aralik</span><strong>{formatDate(report.startDate)} - {formatDate(report.endDate)}</strong></div>
          <div><span>Beklenen</span><strong>{formatQuantity(prediction.expectedValue, prediction.unit)}</strong></div>
          <div><span>Min / Maks</span><strong>{formatQuantity(prediction.minimumValue, prediction.unit)} / {formatQuantity(prediction.maximumValue, prediction.unit)}</strong></div>
          <div><span>Son 7 Gun</span><strong>{formatQuantity(prediction.baseline7, prediction.unit)}</strong></div>
          <div><span>Son 30 Gun</span><strong>{formatQuantity(prediction.baseline30, prediction.unit)}</strong></div>
          <div><span>Son 90 Gun</span><strong>{formatQuantity(prediction.baseline90, prediction.unit)}</strong></div>
          <div><span>Son 12 Ay</span><strong>{formatQuantity(prediction.baseline365, prediction.unit)}</strong></div>
          <div><span>Buyume</span><strong>{formatPercent(prediction.growthPercent)}</strong></div>
          <div><span>Mevsimsellik</span><strong>{formatPercent(prediction.seasonalityScore)}</strong></div>
          <div><span>Kapasite</span><strong>{prediction.expectedCapacityPercent ? formatPercent(prediction.expectedCapacityPercent) : '-'}</strong></div>
          <div><span>Kritik Gun</span><strong>{prediction.daysToCritical >= 900 ? '-' : formatNumber(prediction.daysToCritical, 1)}</strong></div>
        </div>
        <p className="forecasting-notes">{prediction.evidence}</p>
      </section>

      <section className="card forecasting-detail-card">
        <h3>Karar Destek Önerisi</h3>
        <div className="forecasting-recommendation-list">
          <div>
            <strong>{prediction.recommendation}</strong>
            <span>Risk {formatNumber(prediction.riskScore, 1)} / Güven {formatNumber(prediction.confidenceScore, 1)}</span>
          </div>
        </div>
      </section>

      <section className="card forecasting-detail-card">
        <h3>Senaryolar</h3>
        <div className="forecasting-list">
          {report.scenarios.map(scenario => (
            <div className="forecasting-list-row" key={scenario.id}>
              <div>
                <strong>{scenario.name}</strong>
                <span>{scenario.description}</span>
              </div>
              <em>{formatNumber(scenario.demandMultiplier, 2)}x</em>
              <span className={`status-pill ${getRiskClass(scenario.riskLevel)}`}>{FORECAST_RISK_LABELS[scenario.riskLevel]}</span>
              <p>{scenario.expectedImpact}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card forecasting-detail-card">
        <h3>History</h3>
        <div className="forecasting-history-list">
          {[...report.history].reverse().map(history => (
            <div key={history.id}>
              <strong>{getHistoryLabel(history.action)} - {history.actorName}</strong>
              <span>{formatDateTime(history.createdAt)} / Rev {history.revisionNo}</span>
              <p>{history.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kirilim</p>
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

function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{formatNumber(series.points.length)} period</p>
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
