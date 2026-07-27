import type {
  QualityCriterionStatus,
  QualityDecision,
  QualityDecisionType,
  QualityFormStatus,
  QualityInspection,
  QualityInspectionResult
} from './quality-form.types'

const SCORE_BY_STATUS: Record<QualityCriterionStatus, number | null> = {
  PASS: 100,
  WARNING: 70,
  FAIL: 0,
  NOT_APPLICABLE: null
}

const getResultFromStatus = (
  status: QualityCriterionStatus
): QualityInspectionResult => {
  if(status === 'FAIL') return 'FAIL'
  if(status === 'WARNING') return 'CONDITIONAL'
  return 'PASS'
}

export const calculateQualityScore = (
  inspections: Pick<QualityInspection, 'status'>[]
) => {
  const scores = inspections
    .map(inspection => SCORE_BY_STATUS[inspection.status])
    .filter((score): score is number => typeof score === 'number')

  if(scores.length === 0) return 0

  const total = scores.reduce((sum, score) => sum + score, 0)
  return Math.round((total / scores.length + Number.EPSILON) * 100) / 100
}

export const getOverallQualityResult = (
  inspections: Pick<QualityInspection, 'status'>[],
  fallback: QualityInspectionResult = 'PASS'
): QualityInspectionResult => {
  if(inspections.some(inspection => inspection.status === 'FAIL')) return 'FAIL'
  if(inspections.some(inspection => inspection.status === 'WARNING')) return 'CONDITIONAL'
  if(inspections.length === 0) return fallback
  return 'PASS'
}

export const getQualityStatusFromResult = (
  result: QualityInspectionResult,
  fallback: QualityFormStatus = 'DRAFT'
): QualityFormStatus => {
  if(result === 'PASS') return 'APPROVED'
  if(result === 'CONDITIONAL') return 'CONDITIONAL_APPROVED'
  if(result === 'FAIL') return 'REJECTED'
  return fallback
}

export const getQualityDecisionType = (
  result: QualityInspectionResult
): QualityDecisionType => {
  if(result === 'PASS') return 'RELEASE'
  if(result === 'CONDITIONAL') return 'CONDITIONAL_RELEASE'
  return 'REJECT'
}

export const createQualityDecision = (
  formId: string,
  result: QualityInspectionResult,
  decidedBy: string,
  decidedAt: string,
  summary = ''
): QualityDecision => ({
  id: `${formId}_decision`,
  formId,
  result,
  decisionType: getQualityDecisionType(result),
  summary: summary || (
    result === 'PASS'
      ? 'Kontrol kriterleri uygun; serbest birakilabilir.'
      : result === 'CONDITIONAL'
        ? 'Sartli onay; takip ve tekrar kontrol onerilir.'
        : 'Kalite sonucu FAIL; red veya CAPA degerlendirmesi gerekir.'
  ),
  decidedBy,
  decidedAt
})

export const mapCriterionStatusToResult = getResultFromStatus

export const QualityDecisionService = {
  calculateScore: calculateQualityScore,
  getOverallResult: getOverallQualityResult,
  getStatusFromResult: getQualityStatusFromResult,
  getDecisionType: getQualityDecisionType,
  createDecision: createQualityDecision,
  mapCriterionStatusToResult
}
