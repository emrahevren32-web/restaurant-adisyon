import { Product, ProductAllergen } from './types'

export type NutritionFieldKey = 'calories' | 'protein' | 'carbohydrate' | 'fat' | 'fiber' | 'sugar' | 'salt'

export const PRODUCT_ALLERGENS: ProductAllergen[] = [
  'Gluten',
  'Süt',
  'Yumurta',
  'Yer Fıstığı',
  'Fındık',
  'Ceviz',
  'Soya',
  'Susam',
  'Balık',
  'Kabuklu Deniz Ürünleri',
  'Hardal',
  'Kereviz',
  'Lupin',
  'Sülfit',
  'Yumuşakçalar'
]

export const NUTRITION_FIELD_CONFIG: Array<{
  key: NutritionFieldKey
  label: string
  unit: string
  step: string
}> = [
  { key: 'calories', label: 'Kalori', unit: 'kcal', step: '1' },
  { key: 'protein', label: 'Protein', unit: 'g', step: '0.1' },
  { key: 'carbohydrate', label: 'Karbonhidrat', unit: 'g', step: '0.1' },
  { key: 'fat', label: 'Yağ', unit: 'g', step: '0.1' },
  { key: 'fiber', label: 'Lif', unit: 'g', step: '0.1' },
  { key: 'sugar', label: 'Şeker', unit: 'g', step: '0.1' },
  { key: 'salt', label: 'Tuz', unit: 'g', step: '0.01' }
]

export type ProductNutritionInput = Partial<Record<NutritionFieldKey, unknown>> & {
  servingSize?: unknown
  allergens?: unknown
}

export const normalizeNutritionNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export const normalizeServingSize = (value: unknown) => {
  return String(value || '').trim()
}

export const normalizeProductNutrition = (item: ProductNutritionInput) => {
  return NUTRITION_FIELD_CONFIG.reduce<Record<NutritionFieldKey, number>>((acc, field) => {
    acc[field.key] = normalizeNutritionNumber(item[field.key])
    return acc
  }, {
    calories: 0,
    protein: 0,
    carbohydrate: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    salt: 0
  })
}

export const normalizeProductAllergens = (value: unknown): ProductAllergen[] => {
  if(!Array.isArray(value)) return []

  return Array.from(new Set(value))
    .filter((item): item is ProductAllergen => PRODUCT_ALLERGENS.includes(item as ProductAllergen))
}

export const hasNutritionInfo = (product: Pick<Product, NutritionFieldKey | 'servingSize'>) => {
  return NUTRITION_FIELD_CONFIG.some(field => normalizeNutritionNumber(product[field.key]) > 0)
    || normalizeServingSize(product.servingSize).length > 0
}

export const formatNutritionValue = (value: number, unit: string) => {
  const normalized = normalizeNutritionNumber(value)
  if(normalized === 0) return '-'
  return `${normalized.toLocaleString('tr-TR')} ${unit}`
}

export const formatProductAllergens = (allergens: ProductAllergen[]) => {
  return allergens.length > 0 ? allergens.join(', ') : 'Alerjen içermez'
}

export const areNutritionValuesEqual = (
  first: Pick<Product, NutritionFieldKey | 'servingSize'>,
  second: Pick<Product, NutritionFieldKey | 'servingSize'>
) => {
  return NUTRITION_FIELD_CONFIG.every(field => normalizeNutritionNumber(first[field.key]) === normalizeNutritionNumber(second[field.key]))
    && normalizeServingSize(first.servingSize) === normalizeServingSize(second.servingSize)
}

export const areAllergenValuesEqual = (
  first: Pick<Product, 'allergens'>,
  second: Pick<Product, 'allergens'>
) => {
  const firstAllergens = normalizeProductAllergens(first.allergens).sort()
  const secondAllergens = normalizeProductAllergens(second.allergens).sort()

  return firstAllergens.length === secondAllergens.length
    && firstAllergens.every((allergen, index) => allergen === secondAllergens[index])
}
