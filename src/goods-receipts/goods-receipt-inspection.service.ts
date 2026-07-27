import type {
  GoodsReceiptInspection,
  GoodsReceiptInspectionCriterionStatus,
  GoodsReceiptInspectionResult
} from './goods-receipt.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const INSPECTION_CRITERIA: Array<keyof Pick<
  GoodsReceiptInspection,
  'packagingCheck' | 'labelCheck' | 'expiryCheck' | 'lotCheck' | 'visualCheck' | 'hygieneCheck'
>> = [
  'packagingCheck',
  'labelCheck',
  'expiryCheck',
  'lotCheck',
  'visualCheck',
  'hygieneCheck'
]

export const calculateInspectionResult = (
  inspection: Pick<GoodsReceiptInspection, typeof INSPECTION_CRITERIA[number] | 'temperatureC'>
): GoodsReceiptInspectionResult => {
  const statuses = INSPECTION_CRITERIA.map(key => inspection[key])
  if(statuses.includes('FAIL')) return 'FAIL'
  if(statuses.includes('WARNING')) return 'CONDITIONAL'
  if(Number.isFinite(inspection.temperatureC) && (inspection.temperatureC < -25 || inspection.temperatureC > 12)){
    return 'CONDITIONAL'
  }
  return 'PASS'
}

export const createDefaultGoodsReceiptInspection = (
  receiptId: string,
  actorName = 'Mal Kabul'
): GoodsReceiptInspection => {
  const baseInspection: Omit<GoodsReceiptInspection, 'result'> = {
    id: createId('goods_receipt_inspection'),
    receiptId,
    temperatureC: 4,
    packagingCheck: 'PASS',
    labelCheck: 'PASS',
    expiryCheck: 'PASS',
    lotCheck: 'PASS',
    visualCheck: 'PASS',
    hygieneCheck: 'PASS',
    haccpTemperatureRecord: '4 C mal kabul sicaklik kaydi',
    correctiveActionNote: '',
    checkedBy: actorName,
    checkedAt: new Date().toISOString(),
    notes: 'Mal kabul kontrol kriterleri read-model uzerinden kaydedildi.'
  }

  return {
    ...baseInspection,
    result: calculateInspectionResult(baseInspection)
  }
}

export const normalizeCriterionStatus = (
  value: unknown,
  fallback: GoodsReceiptInspectionCriterionStatus = 'PASS'
): GoodsReceiptInspectionCriterionStatus => {
  const normalized = String(value || '').trim().toUpperCase()
  return ['PASS', 'WARNING', 'FAIL'].includes(normalized)
    ? normalized as GoodsReceiptInspectionCriterionStatus
    : fallback
}

export const normalizeInspection = (
  value: Partial<GoodsReceiptInspection> | null | undefined,
  receiptId: string,
  actorName = 'Mal Kabul'
): GoodsReceiptInspection => {
  const base = createDefaultGoodsReceiptInspection(receiptId, actorName)
  const temperature = Number(value?.temperatureC ?? base.temperatureC)
  const normalized: GoodsReceiptInspection = {
    ...base,
    ...value,
    id: String(value?.id || base.id),
    receiptId,
    temperatureC: Number.isFinite(temperature) ? temperature : base.temperatureC,
    packagingCheck: normalizeCriterionStatus(value?.packagingCheck, base.packagingCheck),
    labelCheck: normalizeCriterionStatus(value?.labelCheck, base.labelCheck),
    expiryCheck: normalizeCriterionStatus(value?.expiryCheck, base.expiryCheck),
    lotCheck: normalizeCriterionStatus(value?.lotCheck, base.lotCheck),
    visualCheck: normalizeCriterionStatus(value?.visualCheck, base.visualCheck),
    hygieneCheck: normalizeCriterionStatus(value?.hygieneCheck, base.hygieneCheck),
    haccpTemperatureRecord: String(value?.haccpTemperatureRecord || base.haccpTemperatureRecord),
    correctiveActionNote: String(value?.correctiveActionNote || ''),
    checkedBy: String(value?.checkedBy || actorName || base.checkedBy),
    checkedAt: String(value?.checkedAt || base.checkedAt),
    notes: String(value?.notes || base.notes),
    result: 'PASS'
  }

  return {
    ...normalized,
    result: calculateInspectionResult(normalized)
  }
}

export const GoodsReceiptInspectionService = {
  createDefault: createDefaultGoodsReceiptInspection,
  normalize: normalizeInspection,
  normalizeCriterion: normalizeCriterionStatus,
  calculateResult: calculateInspectionResult
}
