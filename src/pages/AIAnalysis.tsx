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
  AIAnalysisTitle,
  AIFinding,
  AIHistoryAction,
  AIInsight,
  AISeverity
} from '../ai-analysis/ai-analysis.types'
import {
  formatDecisionCurrency as formatCurrency,
  getDecisionInsightTypeClass as getInsightTypeClass,
  getDecisionSeverityClass as getSeverityClass,
  getDecisionSourceModuleLabel as getSourceModuleLabel
} from '../decision-support/decision-support-ui.utils'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, ChartSeries, PieChartSlice } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  formatNumber,
  roundKpi
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

type TodayAction = {
  id: string
  title: string
  detail: string
  priority: AISeverity
}

type HeatmapRow = {
  id: string
  label: string
  cells: Array<{ severity: AISeverity; count: number; averageRisk: number }>
}

const PIE_COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2']

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


const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))


const getStatusClass = (status: AIAnalysisStatus) => {
  if(status === 'GENERATED') return 'warning-pill'
  if(status === 'REVIEWED') return 'success'
  return 'muted-pill'
}

const getHistoryLabel = (action: AIHistoryAction) => {
  if(action === 'CREATED') return 'Oluşturuldu'
  if(action === 'ANALYZED') return 'Analiz Edildi'
  if(action === 'REVIEWED') return 'İncelendi'
  if(action === 'ARCHIVED') return 'Arşivlendi'
  if(action === 'PRINTED') return 'Yazdırıldı'
  if(action === 'PDF') return 'PDF'
  return 'Excel'
}

const getPriorityText = (severity: AISeverity) => {
  if(severity === 'CRITICAL') return 'Kritik'
  if(severity === 'HIGH') return 'Yüksek'
  if(severity === 'MEDIUM') return 'Orta'
  return 'Bilgilendirme'
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

const getAllInsights = (rows: AIAnalysisRow[]) => rows.map(row => row.insight)

const getTopInsights = (insights: AIInsight[], count: number) => (
  [...insights]
    .sort((first, second) => (
      second.priorityScore - first.priorityScore
      || second.riskScore - first.riskScore
      || second.impactScore - first.impactScore
    ))
    .slice(0, count)
)

const estimateFinancialImpact = (insights: AIInsight[]) => {
  const topSignals = getTopInsights(insights, 12)
  const score = topSignals.reduce((total, insight) => (
    total + insight.expectedGainScore * 85 + insight.impactScore * 42 + insight.riskScore * 24
  ), 0)
  return roundKpi(Math.min(185000, Math.max(topSignals.length ? 4500 : 0, score)))
}

const createExecutiveBullets = (insights: AIInsight[]) => {
  const criticalCount = insights.filter(insight => insight.severity === 'CRITICAL').length
  const delayedShipment = insights.find(insight => insight.analysisTitle === 'SHIPMENT' && insight.riskScore >= 60)
  const wasteRisk = insights.find(insight => insight.analysisTitle === 'WASTE' && insight.riskScore >= 55)
  const stockRisk = insights.find(insight => insight.analysisTitle === 'STOCK' && insight.riskScore >= 55)
  const bullets = [
    `${formatNumber(criticalCount)} kritik risk bulundu.`,
    delayedShipment ? `${delayedShipment.relatedEntityName} için sevkiyat gecikmesi bekleniyor.` : 'Sevkiyat tarafında kritik bir sapma görünmüyor.',
    wasteRisk ? `${wasteRisk.relatedEntityName} fire etkisi nedeniyle izlenmeli.` : 'Fire sinyalleri kontrol altında.',
    stockRisk ? `${stockRisk.relatedEntityName} stok riski kritik seviyeye yaklaşıyor.` : 'Stok tarafında kritik eşik aşımı sınırlı.'
  ]

  return bullets
}

const createExecutiveNarrative = (insights: AIInsight[]) => {
  const top = getTopInsights(insights, 1)[0]
  if(!top){
    return 'Bugünkü analiz modeli analizinde kritik sapma bulunmadı. Sistem, dış AI servisine veri göndermeden mevcut operasyon kayıtlarından izleme setini hazır tuttu.'
  }

  const lineText = top.productionLineName || top.machineName || top.relatedEntityName
  const gainMinutes = Math.max(18, Math.round(top.expectedGainScore * 0.7))
  const riskText = AI_ANALYSIS_TITLE_LABELS[top.analysisTitle]

  return `${lineText} alanında ${riskText.toLocaleLowerCase('tr-TR')} sinyali güçlendi. Risk skoru ${formatNumber(top.riskScore, 1)}, etki skoru ${formatNumber(top.impactScore, 1)} seviyesinde. Önerilen aksiyon uygulanırsa günlük yaklaşık ${formatNumber(gainMinutes)} dakikalık operasyonel kazanım potansiyeli oluşabilir.`
}

const createTodayActions = (insights: AIInsight[]): TodayAction[] => (
  getTopInsights(insights, 6).map(insight => ({
    id: insight.id,
    title: insight.recommendedAction || insight.title,
    detail: `${AI_ANALYSIS_TITLE_LABELS[insight.analysisTitle]} / ${insight.relatedEntityName}`,
    priority: insight.severity
  }))
)

const createPieSlices = (
  rows: BarChartRow[]
): PieChartSlice[] => rows.slice(0, PIE_COLORS.length).map((row, index) => ({
  id: row.id,
  label: row.label,
  value: row.value,
  formattedValue: row.formattedValue,
  color: PIE_COLORS[index % PIE_COLORS.length]
}))

const createTrendSeries = (
  reports: AIAnalysisReport[],
  id: string,
  label: string,
  color: string,
  filterInsight: (insight: AIInsight) => boolean
): ChartSeries => {
  const rows = reports.reduce<Map<string, number>>((map, report) => {
    const month = report.reportDate.slice(0, 7)
    const value = report.insights
      .filter(filterInsight)
      .reduce((total, insight) => total + Math.max(1, insight.riskScore / 20), 0)
    map.set(month, roundKpi((map.get(month) || 0) + value))
    return map
  }, new Map())

  return {
    id,
    label,
    color,
    points: Array.from(rows.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(-12)
      .map(([dateKey, value]) => ({
        dateKey,
        label: dateKey,
        value
      }))
  }
}

const createHeatmapRows = (insights: AIInsight[]): HeatmapRow[] => (
  AI_ANALYSIS_TITLES.map(title => {
    const titleInsights = insights.filter(insight => insight.analysisTitle === title)
    const cells = AI_SEVERITIES.map(severity => {
      const severityInsights = titleInsights.filter(insight => insight.severity === severity)
      return {
        severity,
        count: severityInsights.length,
        averageRisk: severityInsights.length
          ? roundKpi(severityInsights.reduce((total, insight) => total + insight.riskScore, 0) / severityInsights.length)
          : 0
      }
    })

    return {
      id: title,
      label: AI_ANALYSIS_TITLE_LABELS[title],
      cells
    }
  }).filter(row => row.cells.some(cell => cell.count > 0))
)

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
  const filteredInsights = React.useMemo(() => getAllInsights(rows), [rows])
  const selectedRow = React.useMemo(() => (
    rows.find(row => row.insight.id === selectedInsightId)
    || rows[0]
    || null
  ), [rows, selectedInsightId])
  const selectedReport = React.useMemo(() => (
    selectedRow
      ? reports.find(report => report.id === selectedRow.report.id) || selectedRow.report
      : reports[0] || null
  ), [reports, selectedRow])
  const selectedFindings = React.useMemo(() => (
    selectedReport && selectedRow
      ? selectedReport.findings.filter(finding => finding.insightId === selectedRow.insight.id)
      : []
  ), [selectedReport, selectedRow])
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
  const criticalRisks = React.useMemo(() => (
    getTopInsights(filteredInsights.filter(insight => insight.severity === 'CRITICAL' || insight.severity === 'HIGH'), 5)
  ), [filteredInsights])
  const todayActions = React.useMemo(() => createTodayActions(filteredInsights), [filteredInsights])
  const executiveBullets = React.useMemo(() => createExecutiveBullets(filteredInsights), [filteredInsights])
  const executiveNarrative = React.useMemo(() => createExecutiveNarrative(filteredInsights), [filteredInsights])
  const financialImpact = React.useMemo(() => estimateFinancialImpact(filteredInsights), [filteredInsights])
  const firstAction = todayActions[0]?.title || 'Kritik risk sahipleriyle kısa aksiyon değerlendirmesi yap.'
  const riskSlices = React.useMemo(() => createPieSlices(statistics.severityRows), [statistics.severityRows])
  const heatmapRows = React.useMemo(() => createHeatmapRows(filteredInsights), [filteredInsights])
  const wasteTrend = React.useMemo(() => createTrendSeries(reports, 'ai-waste-trend', 'Fire Trendi', '#dc2626', insight => insight.analysisTitle === 'WASTE'), [reports])
  const kpiTrend = React.useMemo(() => createTrendSeries(reports, 'ai-kpi-trend', 'KPI Trendi', '#2563eb', insight => insight.sourceModule === 'KPIDashboard'), [reports])
  const timelineInsights = React.useMemo(() => getTopInsights(filteredInsights, 7), [filteredInsights])

  React.useEffect(() => {
    if(selectedInsightId && rows.some(row => row.insight.id === selectedInsightId)) return
    setSelectedInsightId(rows[0]?.insight.id || '')
  }, [rows, selectedInsightId])

  const refreshReports = React.useCallback((targetInsightId?: string) => {
    const nextReports = AIAnalysisService.list(sourceData)
    setReports(nextReports)
    if(targetInsightId) setSelectedInsightId(targetInsightId)
  }, [sourceData])

  const updateFilter = React.useCallback(function updateFilter<TKey extends keyof AIAnalysisFilters>(key: TKey, value: AIAnalysisFilters[TKey]) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateForm = React.useCallback(function updateForm<TKey extends keyof AIAnalysisReportCreateInput>(key: TKey, value: AIAnalysisReportCreateInput[TKey]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const createReport = React.useCallback(() => {
    try{
      const report = AIAnalysisService.add(form, sourceData, userName)
      const firstInsightId = report.insights[0]?.id || ''
      refreshReports(firstInsightId)
      setForm(AIAnalysisService.createDefaultInput(userName))
      setMessage({ type: 'success', text: `${report.reportNo} yapay zeka analiz raporu oluşturuldu.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Yapay zeka analiz raporu oluşturulamadı.' })
    }
  }, [form, refreshReports, sourceData, userName])

  const changeStatus = React.useCallback((status: Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>) => {
    if(!selectedReport) return
    try{
      const report = AIAnalysisService.updateStatus(selectedReport.id, status, sourceData, userName)
      refreshReports(report.insights[0]?.id || selectedInsightId)
      setMessage({ type: 'success', text: `${report.reportNo} ${AI_ANALYSIS_STATUS_LABELS[status]} durumuna alındı.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Yapay zeka analiz durumu güncellenemedi.' })
    }
  }, [refreshReports, selectedInsightId, selectedReport, sourceData, userName])

  const recordOutput = React.useCallback((action: Extract<AIHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>) => {
    if(!selectedReport) return

    try{
      if(action === 'PRINTED') AIPrintService.openPrintWindow(selectedReport, 'A4')
      if(action === 'PDF') AIPrintService.openPrintWindow(selectedReport, 'PDF')
      if(action === 'EXCEL'){
        ExcelIntegrationService.exportModules({
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
          ? `${report.reportNo} Excel olarak dışa aktarıldı.`
          : `${report.reportNo} çıktı penceresi açıldı.`
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Yapay zeka analiz çıktısı alınamadı.' })
    }
  }, [refreshReports, selectedInsightId, selectedReport, sourceData, userName])

  return (
    <div className="ai-analysis-page">
      <div className="page-header">
        <div>
          <h2>Yapay Zeka Analizi</h2>
          <p className="muted">Karar destek, kritik alarm, tahminleme, öneri ve planlama verilerini dış AI servisine gitmeden yapay zeka analiz formatına dönüştürür.</p>
        </div>
      </div>

      {message && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <section className="ai-analysis-executive">
        <div className="ai-analysis-executive-copy">
          <span className="status-pill success">Analiz Modeli Anlık Görüntü</span>
          <h3>Yapay Zeka Yönetici Özeti</h3>
          <p>{executiveNarrative}</p>
          <div className="ai-analysis-executive-bullets">
            {executiveBullets.map(bullet => <span key={bullet}>{bullet}</span>)}
          </div>
        </div>
        <div className="ai-analysis-executive-panel">
          <span>Tahmini finansal etki</span>
          <strong>{formatCurrency(financialImpact)}</strong>
          <small>Önerilen ilk aksiyon</small>
          <p>{firstAction}</p>
        </div>
      </section>

      <div className="ai-analysis-focus-grid">
        <section className="card ai-analysis-focus-card">
          <div className="section-header compact">
            <div>
              <h3>Kritik Riskler</h3>
              <p className="muted">{formatNumber(criticalRisks.length)} öncelikli sinyal</p>
            </div>
            <span className="status-pill danger-pill">{formatNumber(statistics.criticalFindings)} kritik bulgu</span>
          </div>
          <div className="ai-analysis-risk-list">
            {criticalRisks.length === 0 && <div className="empty-cell">Kritik risk bulunmadı.</div>}
            {criticalRisks.map(insight => (
              <button
                key={insight.id}
                className="ai-analysis-risk-row"
                type="button"
                onClick={() => setSelectedInsightId(insight.id)}
              >
                <span className={`status-pill ${getSeverityClass(insight.severity)}`}>{AI_SEVERITY_LABELS[insight.severity]}</span>
                <strong>{insight.title}</strong>
                <small>{insight.relatedEntityName} / Risk {formatNumber(insight.riskScore, 1)}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="card ai-analysis-finance-card">
          <div>
            <span>Beklenen Finansal Etki</span>
            <strong>{formatCurrency(financialImpact)}</strong>
            <p>Risk, etki, beklenen kazanım ve tekrar eden problem sinyallerinden gerçekçi endüstriyel mutfak ölçeğine normalize edildi.</p>
          </div>
          <div className="ai-analysis-finance-bars">
            <div><span>Güven Skoru</span><strong>{formatNumber(statistics.averageConfidence, 1)}</strong></div>
            <div><span>Risk Skoru</span><strong>{formatNumber(statistics.averageRiskScore, 1)}</strong></div>
            <div><span>Beklenen Kazanç</span><strong>{formatNumber(Math.min(statistics.expectedGainScore, 9999), 1)}</strong></div>
          </div>
        </section>

        <section className="card ai-analysis-todo-card">
          <div className="section-header compact">
            <div>
              <h3>Bugün Yapılması Gerekenler</h3>
              <p className="muted">Karar destek önerilerinden türetildi.</p>
            </div>
          </div>
          <div className="ai-analysis-todo-list">
            {todayActions.length === 0 && <div className="empty-cell">Bugün için aksiyon yok.</div>}
            {todayActions.map(action => (
              <button
                key={action.id}
                className="ai-analysis-todo-row"
                type="button"
                onClick={() => setSelectedInsightId(action.id)}
              >
                <span className={`status-pill ${getSeverityClass(action.priority)}`}>{getPriorityText(action.priority)}</span>
                <strong>{action.title}</strong>
                <small>{action.detail}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="card ai-analysis-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler ve Rapor</h3>
            <p className="muted">{formatNumber(rows.length)} bulgu listeleniyor.</p>
          </div>
          <div className="button-group">
            <button className="btn" type="button" onClick={() => setFilters(AIAnalysisService.createDefaultFilters())}>Sıfırla</button>
            <button className="primary-button" type="button" disabled={!form.reportDate || !form.responsiblePerson} onClick={createReport}>Rapor Oluştur</button>
          </div>
        </div>
        <div className="ai-analysis-filter-primary">
          <label className="form-field">
            <span>Analiz Başlığı</span>
            <select value={filters.analysisTitle} onChange={event => updateFilter('analysisTitle', event.target.value as AIAnalysisFilters['analysisTitle'])}>
              <option value={ALL_FILTER}>Tüm Başlıklar</option>
              {AI_ANALYSIS_TITLES.map(title => <option key={title} value={title}>{AI_ANALYSIS_TITLE_LABELS[title]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Seviye</span>
            <select value={filters.severity} onChange={event => updateFilter('severity', event.target.value as AIAnalysisFilters['severity'])}>
              <option value={ALL_FILTER}>Tüm Seviyeler</option>
              {AI_SEVERITIES.map(severity => <option key={severity} value={severity}>{AI_SEVERITY_LABELS[severity]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Şube</span>
            <select value={filters.branchId} onChange={event => updateFilter('branchId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Şubeler</option>
              {branchOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Arama</span>
            <input type="search" value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Rapor no, ürün, hat, makine, öneri" />
          </label>
        </div>
        <div className="ai-analysis-filter-secondary">
          <label className="form-field">
            <span>İçgörü Tipi</span>
            <select value={filters.insightType} onChange={event => updateFilter('insightType', event.target.value as AIAnalysisFilters['insightType'])}>
              <option value={ALL_FILTER}>Tüm Tipler</option>
              {AI_INSIGHT_TYPES.map(type => <option key={type} value={type}>{AI_INSIGHT_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Hat</span>
            <select value={filters.productionLineId} onChange={event => updateFilter('productionLineId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Hatlar</option>
              {lineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Makine</span>
            <select value={filters.machineId} onChange={event => updateFilter('machineId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Makineler</option>
              {machineOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Personel</span>
            <select value={filters.employeeId} onChange={event => updateFilter('employeeId', event.target.value)}>
              <option value={ALL_FILTER}>Tüm Personel</option>
              {employeeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Tarih</span>
            <input type="date" value={filters.date} onChange={event => updateFilter('date', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Rapor Tarihi</span>
            <input type="date" value={form.reportDate} onChange={event => updateForm('reportDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Kapsam</span>
            <select value={form.scope} onChange={event => updateForm('scope', event.target.value as AIAnalysisReportCreateInput['scope'])}>
              <option value={ALL_FILTER}>Tüm Başlıklar</option>
              {AI_ANALYSIS_TITLES.map(title => <option key={title} value={title}>{AI_ANALYSIS_TITLE_LABELS[title]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Sorumlu</span>
            <input value={form.responsiblePerson} onChange={event => updateForm('responsiblePerson', event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card ai-analysis-narrative-card">
        <div className="section-header compact">
          <div>
            <h3>Yapay Zeka Bulguları</h3>
            <p className="muted">Dış AI servisi kullanılmadan analiz modeli verilerinden yorum üretildi.</p>
          </div>
        </div>
        <div className="ai-analysis-narrative-grid">
          {getTopInsights(filteredInsights, 6).map(insight => (
            <button
              className="ai-analysis-narrative-item"
              key={insight.id}
              type="button"
              onClick={() => setSelectedInsightId(insight.id)}
            >
              <span className={`status-pill ${getInsightTypeClass(insight.insightType)}`}>{AI_INSIGHT_TYPE_LABELS[insight.insightType]}</span>
              <strong>{insight.summary || insight.title}</strong>
              <p>{insight.evidence || insight.expectedImpact}</p>
              <small>{insight.recommendedAction}</small>
            </button>
          ))}
          {filteredInsights.length === 0 && <div className="empty-cell">Filtrelere uygun bulgu bulunamadı.</div>}
        </div>
      </section>

      <div className="ai-analysis-chart-grid">
        <PieChartCard title="Risk Dağılımı" slices={riskSlices} />
        <BarChartCard title="Kategori Bazlı Risk" rows={statistics.titleRows} />
        <LineChartCard series={statistics.monthlyTrend} />
        <LineChartCard series={wasteTrend} />
        <LineChartCard series={kpiTrend} />
        <HeatmapCard rows={heatmapRows} />
        <BarChartCard title="Hat Bazlı" rows={statistics.lineRows} />
        <BarChartCard title="Makine Bazlı" rows={statistics.machineRows} />
        <TimelineCard insights={timelineInsights} onSelect={setSelectedInsightId} />
      </div>

      <div className="product-layout ai-analysis-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Detay Liste</h3>
              <p className="muted">Seçili bulgunun detayları sağ panelde gösterilir.</p>
            </div>
            <span className="status-pill">{formatNumber(rows.length)} kayıt</span>
          </div>
          <div className="table-wrap ai-analysis-table-wrap">
            <table className="data-table ai-analysis-table">
              <thead>
                <tr>
                  <th>Rapor</th>
                  <th>Başlık</th>
                  <th>Bulgu</th>
                  <th>Kaynak</th>
                  <th>Güven</th>
                  <th>Risk</th>
                  <th>Etki</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="empty-cell" colSpan={8}>Filtrelere uygun yapay zeka bulgusu bulunamadı.</td></tr>
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
                    <td data-label="Başlık"><strong>{AI_ANALYSIS_TITLE_LABELS[row.insight.analysisTitle]}</strong><span>{AI_INSIGHT_TYPE_LABELS[row.insight.insightType]}</span></td>
                    <td data-label="Bulgu"><strong>{row.insight.title}</strong><span>{row.insight.relatedEntityName}</span></td>
                    <td data-label="Kaynak"><strong>{getSourceModuleLabel(row.insight.sourceModule)}</strong><span>{row.insight.sourceNo}</span></td>
                    <td data-label="Güven">{formatNumber(row.insight.confidenceScore, 1)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getSeverityClass(row.insight.severity)}`}>{AI_SEVERITY_LABELS[row.insight.severity]}</span></td>
                    <td data-label="Etki">{formatNumber(row.insight.impactScore, 1)}</td>
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
              <h3>Analiz Detayı</h3>
              <p className="muted">Detay görmek için bir yapay zeka bulgusu seçin.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

const AIAnalysisDetailPanel = React.memo(function AIAnalysisDetailPanel({
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
          <button className="btn" type="button" onClick={() => onOutput('PRINTED')}>Yazdır</button>
          <button className="btn" type="button" onClick={() => onOutput('PDF')}>PDF</button>
          <button className="btn" type="button" onClick={() => onOutput('EXCEL')}>Excel</button>
        </div>

        <div className="ai-analysis-status-actions">
          <button className="btn" type="button" disabled={getActionDisabled(report, 'REVIEWED')} onClick={() => onStatusChange('REVIEWED')}>İncele</button>
          <button className="btn" type="button" disabled={getActionDisabled(report, 'ARCHIVED')} onClick={() => onStatusChange('ARCHIVED')}>Arşivle</button>
        </div>

        <div className="ai-analysis-detail-grid">
          <div><span>Rapor Tarihi</span><strong>{formatDate(report.reportDate)}</strong></div>
          <div><span>İçgörü Tipi</span><strong>{AI_INSIGHT_TYPE_LABELS[insight.insightType]}</strong></div>
          <div><span>Güven Skoru</span><strong>{formatNumber(insight.confidenceScore, 1)}</strong></div>
          <div><span>Risk Skoru</span><strong>{formatNumber(insight.riskScore, 1)}</strong></div>
          <div><span>Etki Skoru</span><strong>{formatNumber(insight.impactScore, 1)}</strong></div>
          <div><span>Öncelik Skoru</span><strong>{formatNumber(insight.priorityScore, 1)}</strong></div>
          <div><span>Trend Skoru</span><strong>{formatNumber(insight.trendScore, 1)}</strong></div>
          <div><span>Beklenen Kazanç</span><strong>{formatNumber(insight.expectedGainScore, 1)}</strong></div>
          <div><span>Kaynak</span><strong>{getSourceModuleLabel(insight.sourceModule)}</strong></div>
          <div><span>İlgili Modüller</span><strong>{insight.relatedModules.map(getSourceModuleLabel).join(', ') || '-'}</strong></div>
        </div>
        <p className="ai-analysis-notes">{insight.evidence}</p>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>İçgörü ve Öneri</h3>
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
        <h3>Yapay Zeka Bulguları</h3>
        <div className="ai-analysis-finding-list">
          {findings.length === 0 && <div className="empty-cell">Bulgu bulunamadı.</div>}
          {findings.map(finding => (
            <div key={finding.id}>
              <strong>{finding.title}</strong>
              <span>{finding.metricName}: {formatNumber(finding.metricValue, 1)} / eşik {formatNumber(finding.benchmarkValue, 1)}</span>
              <p>{finding.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>Skorlar</h3>
        <div className="ai-analysis-score-list">
          {report.scores.filter(score => score.sampleSize > 0).slice(0, 6).map(score => (
            <div key={score.id}>
              <strong>{AI_ANALYSIS_TITLE_LABELS[score.analysisTitle]}</strong>
              <span>Güven {formatNumber(score.confidenceScore, 1)} / Risk {formatNumber(score.riskScore, 1)} / Etki {formatNumber(score.impactScore, 1)}</span>
              <p>{score.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card ai-analysis-detail-card">
        <h3>Geçmiş</h3>
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
})
const BarChartCard = React.memo(function BarChartCard({ rows, title }: { rows: BarChartRow[]; title: string }){
  const maxValue = Math.max(1, ...rows.map(row => row.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(rows.length)} kırılım</p>
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
              <span style={{ width: `${Math.max(3, (row.value / maxValue) * 100)}%` }} />
            </div>
            <em>{row.formattedValue}</em>
          </div>
        ))}
      </div>
    </section>
  )
})

const LineChartCard = React.memo(function LineChartCard({ series }: { series: ChartSeries }){
  const maxValue = Math.max(1, ...series.points.map(point => point.value))

  return (
    <section className="card kpi-chart-card">
      <div className="section-header compact">
        <div>
          <h3>{series.label}</h3>
          <p className="muted">{formatNumber(series.points.length)} dönem</p>
        </div>
      </div>
      <div className="kpi-line-chart">
        {series.points.length === 0 && <div className="empty-cell">Trend verisi bulunamadı.</div>}
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
})

const PieChartCard = React.memo(function PieChartCard({ slices, title }: { slices: PieChartSlice[]; title: string }){
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  let offset = 0
  const gradient = slices.length > 0
    ? slices.map(slice => {
      const start = offset
      const end = offset + (slice.value / Math.max(1, total)) * 100
      offset = end
      return `${slice.color} ${start}% ${end}%`
    }).join(', ')
    : '#e5e7eb 0% 100%'

  return (
    <section className="card kpi-chart-card ai-analysis-pie-card">
      <div className="section-header compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{formatNumber(total)} bulgu</p>
        </div>
      </div>
      <div className="ai-analysis-pie-layout">
        <div className="ai-analysis-pie-ring" style={{ background: `conic-gradient(${gradient})` }}>
          <strong>{formatNumber(total)}</strong>
          <span>Toplam</span>
        </div>
        <div className="ai-analysis-pie-legend">
          {slices.map(slice => (
            <div key={slice.id}>
              <i style={{ background: slice.color }} />
              <strong>{slice.label}</strong>
              <span>{slice.formattedValue}</span>
            </div>
          ))}
          {slices.length === 0 && <div className="empty-cell">Dağılım verisi yok.</div>}
        </div>
      </div>
    </section>
  )
})

const HeatmapCard = React.memo(function HeatmapCard({ rows }: { rows: HeatmapRow[] }){
  return (
    <section className="card kpi-chart-card ai-analysis-heatmap-card">
      <div className="section-header compact">
        <div>
          <h3>Risk Isı Haritası</h3>
          <p className="muted">Başlık ve seviye yoğunluğu</p>
        </div>
      </div>
      <div className="ai-analysis-heatmap">
        <div className="ai-analysis-heatmap-head">
          <span />
          {AI_SEVERITIES.map(severity => <strong key={severity}>{AI_SEVERITY_LABELS[severity]}</strong>)}
        </div>
        {rows.map(row => (
          <div className="ai-analysis-heatmap-row" key={row.id}>
            <strong>{row.label}</strong>
            {row.cells.map(cell => (
              <span
                key={`${row.id}-${cell.severity}`}
                className={`ai-analysis-heatmap-cell ${cell.severity.toLocaleLowerCase('tr-TR')}`}
                style={{ opacity: cell.count > 0 ? Math.max(0.35, clamp(cell.averageRisk, 20, 100) / 100) : 0.15 }}
              >
                {cell.count || '-'}
              </span>
            ))}
          </div>
        ))}
        {rows.length === 0 && <div className="empty-cell">Isı haritası verisi bulunamadı.</div>}
      </div>
    </section>
  )
})

const TimelineCard = React.memo(function TimelineCard({
  insights,
  onSelect
}: {
  insights: AIInsight[]
  onSelect: (id: string) => void
}){
  return (
    <section className="card kpi-chart-card ai-analysis-timeline-card">
      <div className="section-header compact">
        <div>
          <h3>Analiz Zaman Çizelgesi</h3>
          <p className="muted">Öncelikli bulgular</p>
        </div>
      </div>
      <div className="ai-analysis-timeline">
        {insights.map(insight => (
          <button key={insight.id} type="button" onClick={() => onSelect(insight.id)}>
            <span className={`status-pill ${getSeverityClass(insight.severity)}`}>{AI_SEVERITY_LABELS[insight.severity]}</span>
            <strong>{insight.title}</strong>
            <small>{formatDateTime(insight.createdAt)} / {getSourceModuleLabel(insight.sourceModule)}</small>
          </button>
        ))}
        {insights.length === 0 && <div className="empty-cell">Zaman çizelgesi verisi bulunamadı.</div>}
      </div>
    </section>
  )
})
