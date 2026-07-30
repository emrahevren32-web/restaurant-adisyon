import {
  BOTTLENECK_REPORT_STATUSES,
  BOTTLENECK_RISK_LEVELS
} from './bottleneck-analysis.constants'
import type {
  BottleneckReport,
  BottleneckReportCreateInput,
  BottleneckValidationResult
} from './bottleneck-analysis.types'

const isMissing = (value: unknown) => String(value || '').trim().length === 0

export const validateBottleneckReportCreateInput = (
  input: BottleneckReportCreateInput
): BottleneckValidationResult => {
  const errors: string[] = []

  if(isMissing(input.reportDate)) errors.push('Rapor tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic tarihi zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis tarihi zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')
  if(input.startDate && input.endDate && input.startDate > input.endDate) errors.push('Bitis tarihi baslangictan once olamaz.')
  if(input.riskLevel !== 'all' && !BOTTLENECK_RISK_LEVELS.includes(input.riskLevel)) errors.push('Gecersiz risk seviyesi.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateBottleneckReport = (
  report: BottleneckReport
): BottleneckValidationResult => {
  const errors: string[] = []

  if(isMissing(report.reportNo)) errors.push('Rapor no zorunlu.')
  if(!BOTTLENECK_REPORT_STATUSES.includes(report.status)) errors.push('Gecersiz rapor durumu.')
  if(report.items.length === 0) errors.push('Eksik veri analiz edilemez.')

  report.items.forEach((item, index) => {
    const rowNo = index + 1
    if(isMissing(item.entityId)) errors.push(`${rowNo}. satirda analiz varligi zorunlu.`)
    if(isMissing(item.entityName)) errors.push(`${rowNo}. satirda analiz varligi adi zorunlu.`)
    if(item.riskScore < 0 || item.riskScore > 100) errors.push(`${rowNo}. satirda risk skoru gecersiz.`)
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const BottleneckValidationService = {
  validateCreateInput: validateBottleneckReportCreateInput,
  validate: validateBottleneckReport
}
