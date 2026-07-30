import { averageBy, roundKpi } from '../kpi-reporting/kpi.utils'
import {
  AI_ANALYSIS_TITLE_LABELS
} from './ai-analysis.constants'
import type {
  AIAnalysisTitle,
  AIInsight,
  AIScore,
  AISeverity
} from './ai-analysis.types'

const clamp = (
  value: number,
  min = 0,
  max = 100
) => Math.max(min, Math.min(max, value))

export const mapAISeverity = (
  riskScore: number
): AISeverity => {
  if(riskScore >= 85) return 'CRITICAL'
  if(riskScore >= 65) return 'HIGH'
  if(riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

export const calculateAIConfidence = (
  sourceCount: number,
  sampleSize: number,
  sourceReliability = 72
) => roundKpi(clamp(
  sourceReliability * 0.48
  + Math.min(25, sourceCount * 4.5)
  + Math.min(25, sampleSize * 0.8)
))

export const calculateAIPriorityScore = (
  riskScore: number,
  impactScore: number,
  trendScore: number,
  confidenceScore: number
) => roundKpi(clamp(
  riskScore * 0.38
  + impactScore * 0.28
  + trendScore * 0.18
  + confidenceScore * 0.16
))

export const createAIScore = (
  reportId: string,
  analysisTitle: AIAnalysisTitle,
  insights: AIInsight[]
): AIScore => {
  const titleInsights = insights.filter(insight => insight.analysisTitle === analysisTitle)
  const sourceCount = new Set(titleInsights.flatMap(insight => [insight.sourceModule, ...insight.relatedModules])).size
  const sampleSize = titleInsights.length
  const riskScore = averageBy(titleInsights, insight => insight.riskScore)
  const impactScore = averageBy(titleInsights, insight => insight.impactScore)
  const trendScore = averageBy(titleInsights, insight => insight.trendScore)
  const confidenceScore = calculateAIConfidence(sourceCount, sampleSize, averageBy(titleInsights, insight => insight.confidenceScore) || 68)
  const priorityScore = calculateAIPriorityScore(riskScore, impactScore, trendScore, confidenceScore)

  return {
    id: `${reportId}_score_${analysisTitle.toLocaleLowerCase('tr-TR')}`,
    reportId,
    analysisTitle,
    confidenceScore,
    riskScore: roundKpi(riskScore),
    impactScore: roundKpi(impactScore),
    priorityScore,
    trendScore: roundKpi(trendScore),
    sampleSize,
    sourceCount,
    summary: sampleSize > 0
      ? `${AI_ANALYSIS_TITLE_LABELS[analysisTitle]} icin ${sampleSize} AI insight, ${sourceCount} kaynak ve ${roundKpi(priorityScore)} oncelik skoru.`
      : `${AI_ANALYSIS_TITLE_LABELS[analysisTitle]} icin anlamli AI insight bulunamadi.`
  }
}

export const AIScoreService = {
  calculateConfidence: calculateAIConfidence,
  calculatePriorityScore: calculateAIPriorityScore,
  mapSeverity: mapAISeverity,
  createScore: createAIScore
}
