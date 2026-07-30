import {
  IMPROVEMENT_AREAS,
  IMPROVEMENT_REPORT_STATUSES
} from './continuous-improvement.constants'
import type {
  ImprovementReport,
  ImprovementReportCreateInput,
  ImprovementValidationResult
} from './continuous-improvement.types'

const isMissing = (value: unknown) => String(value || '').trim().length === 0

export const validateImprovementReportCreateInput = (
  input: ImprovementReportCreateInput
): ImprovementValidationResult => {
  const errors: string[] = []

  if(isMissing(input.reportDate)) errors.push('Rapor tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic tarihi zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis tarihi zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')
  if(input.startDate && input.endDate && input.startDate > input.endDate) errors.push('Bitis tarihi baslangictan once olamaz.')
  if(input.area !== 'all' && !IMPROVEMENT_AREAS.includes(input.area)) errors.push('Gecersiz iyilestirme alani.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateImprovementReport = (
  report: ImprovementReport
): ImprovementValidationResult => {
  const errors: string[] = []

  if(isMissing(report.reportNo)) errors.push('Rapor no zorunlu.')
  if(!IMPROVEMENT_REPORT_STATUSES.includes(report.status)) errors.push('Gecersiz rapor durumu.')
  if(report.opportunities.length === 0) errors.push('Eksik veri analiz edilemez.')

  report.opportunities.forEach((opportunity, index) => {
    const rowNo = index + 1
    if(isMissing(opportunity.entityId)) errors.push(`${rowNo}. satirda iyilestirme varligi zorunlu.`)
    if(isMissing(opportunity.entityName)) errors.push(`${rowNo}. satirda iyilestirme varligi adi zorunlu.`)
    if(opportunity.expectedBenefitScore < 0 || opportunity.expectedBenefitScore > 100) errors.push(`${rowNo}. satirda fayda skoru gecersiz.`)
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const ImprovementValidationService = {
  validateCreateInput: validateImprovementReportCreateInput,
  validate: validateImprovementReport
}
