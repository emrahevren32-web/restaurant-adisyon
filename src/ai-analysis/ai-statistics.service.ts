import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  AI_ANALYSIS_TITLE_LABELS,
  AI_INSIGHT_TYPE_LABELS,
  AI_SEVERITY_LABELS
} from './ai-analysis.constants'
import type {
  AIAnalysisReport,
  AIInsight,
  AIStatistics
} from './ai-analysis.types'

const flattenInsights = (
  reports: AIAnalysisReport[]
) => reports.flatMap(report => report.insights)

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>
): BarChartRow[] => rows
  .filter(row => row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatNumber(row.value, 0),
    detail: row.detail
  }))

const aggregateBy = (
  insights: AIInsight[],
  getKey: (insight: AIInsight) => string,
  getLabel: (insight: AIInsight) => string
) => {
  const rows = insights.reduce<Map<string, { label: string; count: number; risk: number; impact: number }>>((map, insight) => {
    const key = getKey(insight)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(insight),
      count: (previous?.count || 0) + 1,
      risk: roundKpi((previous?.risk || 0) + insight.riskScore),
      impact: roundKpi((previous?.impact || 0) + insight.impactScore)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} insight / ${formatNumber(row.impact, 1)} impact`
  })))
}

const aggregateTitleRows = (
  insights: AIInsight[]
) => {
  const rows = insights.reduce<Map<string, number>>((map, insight) => {
    map.set(insight.analysisTitle, (map.get(insight.analysisTitle) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([title, count]) => ({
    id: title,
    label: AI_ANALYSIS_TITLE_LABELS[title as AIInsight['analysisTitle']],
    value: count,
    detail: `${formatNumber(count)} insight`
  })))
}

const aggregateInsightTypeRows = (
  insights: AIInsight[]
) => {
  const rows = insights.reduce<Map<string, number>>((map, insight) => {
    map.set(insight.insightType, (map.get(insight.insightType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: AI_INSIGHT_TYPE_LABELS[type as AIInsight['insightType']],
    value: count,
    detail: `${formatNumber(count)} bulgu`
  })))
}

const aggregateSeverityRows = (
  insights: AIInsight[]
) => {
  const rows = insights.reduce<Map<string, number>>((map, insight) => {
    map.set(insight.severity, (map.get(insight.severity) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([severity, count]) => ({
    id: severity,
    label: AI_SEVERITY_LABELS[severity as AIInsight['severity']],
    value: count,
    detail: `${formatNumber(count)} seviye`
  })))
}

export const createAIStatistics = (
  reports: AIAnalysisReport[]
): AIStatistics => {
  const insights = flattenInsights(reports)
  const findings = reports.flatMap(report => report.findings)

  return {
    totalInsights: insights.length,
    criticalFindings: findings.filter(finding => finding.severity === 'CRITICAL').length,
    topRiskCount: insights.filter(insight => insight.riskScore >= 75 || insight.priorityScore >= 75).length,
    expectedGainScore: roundKpi(sumBy(insights, insight => insight.expectedGainScore)),
    averageConfidence: averageBy(insights, insight => insight.confidenceScore),
    averageRiskScore: averageBy(insights, insight => insight.riskScore),
    titleRows: aggregateTitleRows(insights),
    insightTypeRows: aggregateInsightTypeRows(insights),
    severityRows: aggregateSeverityRows(insights),
    branchRows: aggregateBy(insights, insight => insight.branchId, insight => insight.branchName),
    lineRows: aggregateBy(insights, insight => insight.productionLineId, insight => insight.productionLineName),
    machineRows: aggregateBy(insights, insight => insight.machineId, insight => insight.machineCode || insight.machineName),
    personnelRows: aggregateBy(insights, insight => insight.employeeId, insight => insight.employeeName),
    categoryRows: aggregateBy(insights, insight => insight.categoryId, insight => insight.categoryName),
    monthlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => report.insights.length,
      'Aylik AI Analysis Trend',
      '#0f766e'
    )
  }
}

export const AIStatisticsService = {
  create: createAIStatistics
}
