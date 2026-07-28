import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  ProductionPlan,
  ProductionPlanCreateInput,
  ProductionPlanningValidationResult
} from './production-planning.types'

const isMissing = (value: string) => !String(value || '').trim()
const normalizeSearchText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('tr-TR')

export const validateProductionPlanCreateInput = (
  input: ProductionPlanCreateInput
): ProductionPlanningValidationResult => {
  const errors: string[] = []

  if(isMissing(input.planType)) errors.push('Plan turu zorunlu.')
  if(isMissing(input.planDate)) errors.push('Plan tarihi zorunlu.')
  if(isMissing(input.startDate)) errors.push('Baslangic zorunlu.')
  if(isMissing(input.endDate)) errors.push('Bitis zorunlu.')
  if(input.startDate && input.endDate && input.endDate < input.startDate) errors.push('Bitis tarihi baslangictan once olamaz.')
  if(isMissing(input.branchId)) errors.push('Sube zorunlu.')
  if(isMissing(input.facilityId)) errors.push('Uretim tesisi zorunlu.')
  if(isMissing(input.shift)) errors.push('Vardiya zorunlu.')
  if(isMissing(input.responsiblePerson)) errors.push('Sorumlu zorunlu.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const validateProductionPlan = (
  plan: ProductionPlan,
  sourceData: KpiSourceData
): ProductionPlanningValidationResult => {
  const errors: string[] = []

  if(plan.items.length === 0) errors.push('Plan satiri zorunlu.')

  plan.items.forEach(item => {
    if(isMissing(item.productId) && isMissing(item.productName)) errors.push(`${item.productName || item.id}: Urun zorunlu.`)
    if(isMissing(item.recipeId)) errors.push(`${item.productName}: Recete zorunlu.`)
    if(item.produceQuantity < 0) errors.push(`${item.productName}: Negatif uretim olmaz.`)

    const recipe = sourceData.recipeRecords.find(record => record.id === item.recipeId)
    if(recipe && normalizeSearchText(recipe.status).includes('pasif')){
      errors.push(`${item.productName}: Pasif recete planlanamaz.`)
    }

    const stockItem = sourceData.stockItems.find(record => (
      record.id === item.productId
      || normalizeSearchText(record.name) === normalizeSearchText(item.productName)
      || normalizeSearchText(record.sku) === normalizeSearchText(item.productCode)
    ))
    if(stockItem && stockItem.active === false) errors.push(`${item.productName}: Pasif urun planlanamaz.`)
  })

  return {
    valid: errors.length === 0,
    errors
  }
}

export const PlanningValidationService = {
  validateCreateInput: validateProductionPlanCreateInput,
  validate: validateProductionPlan
}
