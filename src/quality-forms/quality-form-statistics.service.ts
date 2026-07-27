import {
  KPI_COLORS,
  createBarRows,
  createTrend,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type {
  QualityForm,
  QualityStatistics
} from './quality-form.types'

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const activeForms = (
  forms: QualityForm[]
) => forms.filter(form => form.status !== 'CANCELLED')

const createGroupedRows = (
  forms: QualityForm[],
  getKey: (form: QualityForm) => string,
  getLabel: (form: QualityForm) => string
) => createBarRows(
  Array.from(forms.reduce<Map<string, { label: string; count: number; fail: number }>>((map, form) => {
    const key = getKey(form)
    if(!key) return map
    const current = map.get(key) || { label: getLabel(form), count: 0, fail: 0 }
    map.set(key, {
      label: current.label,
      count: current.count + 1,
      fail: current.fail + (form.result === 'FAIL' ? 1 : 0)
    })
    return map
  }, new Map()).entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: row.count,
      detail: `${row.fail} FAIL / ${roundKpi(percent(row.fail, row.count))}%`
    })),
  8
)

export const createQualityFormStatistics = (
  forms: QualityForm[]
): QualityStatistics => {
  const usableForms = activeForms(forms)
  const passed = usableForms.filter(form => form.result === 'PASS').length
  const failed = usableForms.filter(form => form.result === 'FAIL').length
  const conditionalApproved = usableForms.filter(form => form.result === 'CONDITIONAL').length
  const pending = usableForms.filter(form => form.status === 'DRAFT' || form.status === 'INSPECTING').length

  return {
    todayControls: usableForms.filter(form => form.inspectionDate === todayKey()).length,
    passed,
    conditionalApproved,
    failed,
    pending,
    totalForms: usableForms.length,
    passRate: percent(passed, usableForms.length),
    failRate: percent(failed, usableForms.length),
    branchRows: createGroupedRows(usableForms, form => form.branchId, form => form.branchName),
    productRows: createGroupedRows(usableForms, form => form.productId || form.stockItemId, form => form.productName || form.stockItemName),
    supplierRows: createGroupedRows(usableForms, form => form.supplierId, form => form.supplierName || 'Supplier Yok'),
    typeRows: createGroupedRows(usableForms, form => form.formType, form => form.formType),
    resultRows: createGroupedRows(usableForms, form => form.result, form => form.result),
    monthlyTrend: createTrend(
      usableForms,
      'YEAR',
      form => form.inspectionDate,
      () => 1,
      'Aylik Kalite Form Trendi',
      KPI_COLORS[3]
    )
  }
}

export const QualityFormStatisticsService = {
  create: createQualityFormStatistics,
  totalScore: (forms: QualityForm[]) => sumBy(activeForms(forms), form => form.score)
}
