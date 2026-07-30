import React from 'react'
import {
  AI_ANALYSIS_STATUS_LABELS,
  AI_ANALYSIS_TITLE_LABELS,
  AI_ANALYSIS_TITLES,
  AI_INSIGHT_TYPE_LABELS,
  AI_INSIGHT_TYPES,
  AI_SEVERITIES,
  AI_SEVERITY_LABELS,
  AIAnalysisService
} from '../ai-analysis/ai-analysis.service'
import { AIPrintService } from '../ai-analysis/ai-print.service'
import type {
  AIAnalysisFilters,
  AIAnalysisReport,
  AIAnalysisReportCreateInput,
  AIAnalysisStatus,
  AIFinding,
  AIHistoryAction,
  AIInsight,
  AIInsightType,
  AISeverity
} from '../ai-analysis/ai-analysis.types'
import { ExcelExportService } from '../excel-engine/excel-export.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber
} from '../kpi-reporting/kpi.utils'
import { loadEmployees } from '../storage'
import type { User } from '../types'

type Message = {
  type: 'success' | 'error'
  text: string
}

type AIAnalysisRow = {
  report: AIAnalysisReport
  insight: AIInsight
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

const getSeverityClass = (severity: AISeverity) => {
  if(severity === 'CRITICAL') return 'danger-pill'
  if(severity === 'HIGH') return 'warning-pill'
  if(severity === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const getInsightTypeClass = (type: AIInsightType) => {
  if(type === 'RISK') return 'danger-pill'
  if(type === 'ANOMALY' || type === 'REPEATING_PROBLEM') return 'warning-pill'
  if(type === 'OPPORTUNITY') return 'success'
  return 'muted-pill'
}

const getStatusClass = (status: AIAnalysisStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: AIHistoryAction) => {
  if(action === 'CREATED') return 'Olusturuldu'
  if(action === 'ANALYZED') return 'Analiz Edildi'
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
  report: AIAnalysisReport | null,
  status: Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>
) => {
  if(!report) return true
  if(report.status === 'ARCHIVED') return true
  return report.status === status
}

export default function AIAnalysis({ currentUser }: { currentUser: User }){
  const userName = getUserName(currentUser)
  const sourceData = React.useMemo(loadKpiSourceData, [])
  const [reports, setReports] = React.useState<AIAnalysisReport[]>(() => AIAnalysisService.list(sourceData))
  const [filters, setFilters] = React.useState<AIAnalysisFilters>(() => AIAnalysisService.createDefaultFilters())
  const [selectedInsightId, setSelectedInsightId] = React.useState('')
  const [message, setMessage] = React.useState<Message | null>(null)
  const [form, setForm] = React.useState<AIAnalysisReportCreateInput>(() => AIAnalysisService.createDefaultInput(userName))
  const filteredReports = React.useMemo(() => AIAnalysisService.filter(reports, filters), [reports, filters])
  const rows = React.useMemo<AIAnalysisRow[]>(() => (
    filteredReports.flatMap(report => report.insights.map(insight => ({ report, insight })))
  ), [filteredReports])
  const statistics = React.useMemo(() => AIAnalysisService.statistics(reports), [reports])
  const selectedRow = rows.find(row => row.insight.id === selectedInsightId)
    || rows[0]
    || null
  const selectedReport = selectedRow
    ? reports.find(report => report.id === selectedRow.report.id) || selectedRow.report
    : reports[0] || null
  const selectedFindings = selectedReport && selectedRow
    ? selectedReport.findings.filter(finding => finding.insightId === selectedRow.insight.id)
    : []
  const branchOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.branches.map(branch => ({ id: branch.id, name: branch.name })),
    ...reports.flatMap(report => report.insights.map(insight => ({ id: insight.branchId, name: insight.branchName || insight.branchId })))
  ]), [reports, sourceData])
  const lineOptions = React.useMemo(() => uniqueOptions([
    ...sourceData.productionLines.map(line => ({ id: line.id, name: `${line.code} / ${line.name}` })),
    ...reports.flatMap(report => report.insights.map(insight => ({ id: insight.productionLineId, name: insight.productionLineName })))
  ]), [reports, sourceData])
  const machineOptions = React.useMemo(() => uniqueOptions(reports.flatMap(report => report.insights.map(insight => ({
    id: insight.machineId,
    name: `${insight.machineCode || insight.machineId} / ${insight.machineName || insight.relatedEntityName}`
  })))), [reports])
  const employeeOptions = React.useMemo(() => uniqueOptions([
    ...loadEmployees().map(employee => ({ id: employee.id, name: `${employee.code} / ${employee.fullName}` })),
    ...reports.flatMap(report => report.insights.map(insight => ({ id: insight.employeeId, name: insight.employeeName || insight.employeeId })))
  ]), [reports])

  React.useEffect(() => {
    if(selectedInsightId && rows.some(row => row.insight.id === selectedInsightId)) return
    setSelectedInsightId(rows[0]?.insight.id || '')
  }, [rows, selectedInsightId])

  const refreshReports = (targetInsightId?: string) => {
    const nextReports = AIAnalysisService.list(sourceData)
    setReports(nextReports)
    if(targetInsightId) setSelectedInsightId(targetInsightId)
  }

  const updateFilter = <TKey extends keyof AIAnalysisFilters>(key: TKey, value: AIAnalysisFilters[TKey]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const updateForm = <TKey extends keyof AIAnalysisReportCreateInput>(key: TKey, value: AIAnalysisReportCreateInput[TKey]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const createReport = () => {
    try{
      const report = AIAnalysisService.add(form, sourceData, userName)
      const firstInsightId = report.insights[0]?.id || ''
      refreshReports(firstInsightId)
      setForm(AIAnalysisService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} AI analiz raporu olusturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'AI Analysis raporu olusturulamadi.' })
    }
  }

  const changeStatus = (status: Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = AIAnalysisService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.insights[0]?.id || selectedInsightId)
      setMessage({ type: 'success', text: `${report.reportNo} ${AI_ANALYSIS_STATUS_LABELS[status]} durumuna alindi.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'AI Analysis durumu guncellenemedi.' })
    }
  }

  const recordOutput = (action: Extract<AIHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') AIPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') AIPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelExportService.exportModules({
          moduleKeys: ['ai-analysis'],
          scope: 'SELECTED',
          filterText: '',
          selectedRecordIds: [selectedReport.id],
          userName
        })
      }

      const report = AIAnalysisService.recordOutput(selectedReport.id, action, sourceData, userName)
      refreshReports(report.insights[0]?.id || selectedInsightId)
      setMessage({
        type: 'success',
        text: action === 'EXCEL'
          ? `${report.reportNo} Excel export edildi.`
          : `${report.reportNo} cikti penceresi acildi.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'AI Analysis ciktisi alinamadi.' })
    }
  }

  return (
    <div className="ai-analysis-page">
      <div className="page-header">
        <div>
          <h2>AI Analiz</h2>
          <p className="muted">Decision Support, kritik alarm, forecasting, recommendation ve planlama verilerini dis AI servisine gitmeden AI-ready analiz formatina donusturur.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="metric-grid ai-analysis-metric-grid">
        <div className="metric-card">
          <span>AI Ic goruleri</span>
          <strong>{formatNumber(statistics.totalInsights)}</strong>
          <small>{formatNumber(rows.length)} filtre sonucu</small>
        </div>
        <div className="metric-card danger">
          <span>Kritik Bulgular</span>
          <strong>{formatNumber(statistics.criticalFindings)}</strong>
          <small>CRITICAL seviye</small>
        </div>
        <div className="metric-card warning">
          <span>Onemli Riskler</span>
          <strong>{formatNumber(statistics.topRiskCount)}</strong>
          <small>Risk veya priority 75 uzeri</small>
        </div>
        <div className="metric-card success">
          <span>Beklenen Kazanc</span>
          <strong>{formatNumber(statistics.expectedGainScore, 1)}</strong>
          <small>Toplam AI gain skoru</small>
        </div>
        <div className="metric-card">
          <span>AI Confidence</span>
          <strong>{formatNumber(statistics.averageConfidence, 1)}</strong>
          <small>Risk {formatNumber(statistics.averageRiskScore, 1)}</small>
        </div>
      </div>

      <section className="card ai-analysis-create-card">
        <div className="section-header compact">
          <div>
            <h3>Yeni AI Analiz Raporu</h3>
            <p className="muted">Sadece AI'ya hazir analiz verisi olusturur; operasyonel kayit veya dis AI istegi olusturmaz.</p>
          </div>
          <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Olustur</button>
        </div>
        <div className="ai-analysis-create-grid">
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as AIAnalysisReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tum Basliklar</option>
              {AI_ANALYSIS_TITLES.map(title => <option key={title} value={title}>{AI_ANALYSIS_TITLE_LABELS[title]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
          <label className="form-field ai-analysis-wide">
            <span>Aciklama</span>
            <input value={form.description} onChange={event => updateForm('description', event.target.value)} placeholder="AI analiz notu" />
          </label>
        </div>
      </section>

      <section className="card ai-analysis-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(rows.length)} insight listeleniyor.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(AIAnalysisService.createDefaultFilters())}>Sifirla</button>
        </div>
        <div className="ai-analysis-filter-grid">
          <label className="form-field">
            <span>Analiz Basligi</span>
            <select value={filters.analysisTitle} onChange={event => updateFilter('analysisTitle', event.target.value as AIAnalysisFilters['analysisTitle'])}>
              <option value={ALL_FILTER}>Tum Basliklar</option>
              {AI_ANALYSIS_TITLES.map(title => <option key={title} value={title}>{AI_ANALYSIS_TITLE_LABELS[title]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Insight Tipi</span>
            <select value={filters.insightType} onChange={event => updateFilter('insightType', event.target.value as AIAnalysisFilters['insightType'])}>
              <option value={ALL_FILTER}>Tum Tipler</option>
              {AI_INSIGHT_TYPES.map(type => <option key={type} value={type}>{AI_INSIGHT_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Seviye</span>
            <select value={filters.severity} onChange={event => updateFilter('severity', event.target.value as AIAnalysisFilters['severity'])}>
              <option value={ALL_FILTER}>Tum Seviyeler</option>
              {AI_SEVERITIES.map(severity => <option key={severity} value={severity}>{AI_SEVERITY_LABELS[severity]}</option>)}
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
          <label className="form-field ai-analysis-wide">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, insight, kaynak, entity, hat, makine" />
          </label>
        </div>
      </section>

      <div className="ai-analysis-chart-grid">
        <BarChartCard title="Analiz Basligi" rows={statistics.titleRows} />
        <BarChartCard title="Insight Tipi" rows={statistics.insightTypeRows} />
        <BarChartCard title="Seviye" rows={statistics.severityRows} />
        <BarChartCard title="Sube Bazli" rows={statistics.branchRows} />
        <BarChartCard title="Hat Bazli" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazli" rows={statistics.machineRows} />
        <BarChartCard title="Personel Bazli" rows={statistics.personnelRows} />
        <BarChartCard title="Kategori Bazli" rows={statistics.categoryRows} />
        <LineChartCard series={statistics.monthlyTrend} />
      </div>

      <div className="product-layout ai-analysis-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>AI Insight Listesi</h3>
              <p className="muted">Veri seti AI servislerine gonderilmez; merkezi analiz ve yonetici gorunurlugu icin hazirlanir.</p>
            </div>
            <span className="status-pill">{formatNumber(statistics.criticalFindings)} kritik bulgu</span>
          </div>
          <div className="table-wrap ai-analysis-table-wrap">
            <table className="data-table ai-analysis-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Baslik</th>
                  <th>Insight</th>
                  <th>Kaynak</th>
                  <th>Confidence</th>
                  <th>Risk</th>
                  <th>Impact</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun AI insight bulunamadi.</td></tr>
                )}
                {rows.map(row => (
                  <tr
                    key={row.insight.id}
                    aria-selected={selectedRow?.insight.id === row.insight.id}
                    tabIndex={0}
                    onClick={() => {
                      setSelectedInsightId(row.insight.id)
                      setMessage(null)
                    }}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setSelectedInsightId(row.insight.id)
                    }}
                  >
                    <td data-label="Rapor"><strong>{row.report.reportNo}</strong><span>{formatDate(row.report.reportDate)}</span></td>
                    <td data-label="Baslik"><strong>{AI_ANALYSIS_TITLE_LABELS[row.insight.analysisTitle]}</strong><span>{AI_INSIGHT_TYPE_LABELS[row.insight.insightType]}</span></td>
                    <td data-label="Insight"><strong>{row.insight.title}</strong><span>{row.insight.relatedEntityName}</span></td>
                    <td data-label="Kaynak"><strong>{row.insight.sourceModule}</strong><span>{row.insight.sourceNo}</span></td>
                    <td data-label="Confidence">{formatNumber(row.insight.confidenceScore, 1)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getSeverityClass(row.insight.severity)}`}>{AI_SEVERITY_LABELS[row.insight.severity]}</span></td>
                    <td data-label="Impact">{formatNumber(row.insight.impactScore, 1)}</td>
                    <td data-label="Durum"><span className={`status-pill ${getStatusClass(row.report.status)}`}>{AI_ANALYSIS_STATUS_LABELS[row.report.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side ai-analysis-side">
          {selectedRow && selectedReport ? (
            <AIAnalysisDetailPanel
              findings={selectedFindings}
              insight={selectedRow.insight}
              report={selectedReport}
              onOutput={recordOutput}
              onStatusChange={changeStatus}
            />
          ) : (
            <section className="card ai-analysis-detail-card">
              <h3>AI Detayi</h3>
              <p className="muted">Detay gormek icin bir AI insight satiri secin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function AIAnalysisDetailPanel({
  findings,
  insight,
  onOutput,
  onStatusChange,
  report
}: {
  findings: AIFinding[]
  insight: AIInsight
  onOutput: (action: Extract<AIHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => void
  onStatusChange: (status: Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>) => void
  report: AIAnalysisReport
}){
  return (
    <>
      <section className="card ai-analysis-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{report.reportNo}</h3>
            <p className="muted">{AI_ANALYSIS_TITLE_LABELS[insight.analysisTitle]} / {insight.relatedEntityName}</p>
          </div>
          <span className={`status-pill ${getSeverityClass(insight.severity)}`}>{AI_SEVERITY_LABELS[insight.severity]}</span>
        </div>

        <div className="ai-analysis-output-actions">
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdir</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="ai-analysis-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>Incele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arsivle</button>
        </div>

        <div className="ai-analysis-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>Insight Tipi</span><strong>{AI_INSIGHT_TYPE_LABELS[insight.insightType]}</strong></div>
          <div><span>AI Confidence</span><strong>{formatNumber(insight.confidenceScore, 1)}</strong></div>
          <div><span>Risk Score</span><strong>{formatNumber(insight.riskScore, 1)}</strong></div>
          <div><span>Impact Score</span><strong>{formatNumber(insight.impactScore, 1)}</strong></div>
          <div><span>Priority Score</span><strong>{formatNumber(insight.priorityScore, 1)}</strong></div>
          <div><span>Trend Score</span><strong>{formatNumber(insight.trendScore, 1)}</strong></div>
          <div><span>Beklenen Kazanc</span><strong>{formatNumber(insight.expectedGainScore, 1)}</strong></div>
          <div><span>Kaynak</span><strong>{insight.sourceModule}</strong></div>
          <div><span>Ilgili Moduller</span><strong>{insight.relatedModules.join(', ') || '-'}</strong></div>
        </div>
        <p className="ai-analysis-notes">{insight.evidence}</p>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>Ic goru ve Oneri</h3>
        <div className="ai-analysis-insight-list">
          <div>
            <strong>{insight.summary}</strong>
            <span>{insight.expectedImpact}</span>
          </div>
          <div>
            <strong>{insight.recommendedAction}</strong>
            <span>{insight.suggestedPromptContext}</span>
          </div>
        </div>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>AI Bulgulari</h3>
        <div className="ai-analysis-finding-list">
          {findings.length === 0 && <div className="empty-cell">Bulgu bulunamadi.</div>}
          {findings.map(finding => (
            <div key={finding.id}>
              <strong>{finding.title}</strong>
              <span>{finding.metricName}: {formatNumber(finding.metricValue, 1)} / benchmark {formatNumber(finding.benchmarkValue, 1)}</span>
              <p>{finding.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>AI Score</h3>
        <div className="ai-analysis-score-list">
          {report.scores.filter(score => score.sampleSize > 0).slice(0, 6).map(score => (
            <div key={score.id}>
              <strong>{AI_ANALYSIS_TITLE_LABELS[score.analysisTitle]}</strong>
              <span>Confidence {formatNumber(score.confidenceScore, 1)} / Risk {formatNumber(score.riskScore, 1)} / Impact {formatNumber(score.impactScore, 1)}</span>
              <p>{score.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>History</h3>
        <div className="ai-analysis-history-list">
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
