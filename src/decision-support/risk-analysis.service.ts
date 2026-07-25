import { getDecisionRule } from './decision-rules'
import type {
  DecisionPriority,
  DecisionRisk,
  RiskItem
} from './decision-support.types'

const RISK_BASE_SCORE: Record<DecisionRisk, number> = {
  LOW: 20,
  MEDIUM: 42,
  HIGH: 68,
  CRITICAL: 86
}

export const getRiskFromScore = (score: number): DecisionRisk => {
  if(score >= 85) return 'CRITICAL'
  if(score >= 65) return 'HIGH'
  if(score >= 35) return 'MEDIUM'
  return 'LOW'
}

export const getPriorityFromRisk = (risk: DecisionRisk): DecisionPriority => {
  if(risk === 'CRITICAL') return 'URGENT'
  if(risk === 'HIGH') return 'HIGH'
  if(risk === 'MEDIUM') return 'NORMAL'
  return 'LOW'
}

export const calculateRiskScore = (
  ruleId: string,
  evidenceScore: number
) => {
  const rule = getDecisionRule(ruleId)
  const baseScore = RISK_BASE_SCORE[rule?.baseRisk || 'MEDIUM']
  const normalizedEvidence = Math.max(0, Math.min(30, evidenceScore))

  return Math.max(0, Math.min(100, Math.round(baseScore + normalizedEvidence)))
}

export const createRiskItem = (
  ruleId: string,
  evidenceScore: number,
  evidence: string
): RiskItem => {
  const score = calculateRiskScore(ruleId, evidenceScore)

  return {
    score,
    risk: getRiskFromScore(score),
    evidence
  }
}
