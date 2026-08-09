import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { AIAnalysisService } from '../ai-analysis/ai-analysis.service'
import type { AIInsight } from '../ai-analysis/ai-analysis.types'
import { createDefaultCostEngineFilters, createCostEngineView } from '../cost-engine/cost-engine.service'
import type { CostComponent, CostEngine } from '../cost-engine/cost-engine.types'
import { CostOptimizationService } from '../cost-optimization/cost-optimization.service'
import type { CostOptimizationItem } from '../cost-optimization/cost-optimization.types'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  addDays,
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import { PurchaseRecommendationService } from '../purchase-recommendations/purchase-recommendation.service'
import type { PurchaseRecommendationItem } from '../purchase-recommendations/purchase-recommendation.types'
import type { User } from '../types'
import { WasteService } from '../waste-management/waste.service'
import type { WasteRecord } from '../waste-management/waste.types'

type CostRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type ProfitabilityState = 'Karlı' | 'Düşük Marj' | 'Zarar Riski'

type CostAnalyticsFilters = {
  startDate: string
  endDate: string
  branchId: string
  productId: string
  categoryId: string
  recipeId: string
  lineId: string
  productionOrderId: string
  risk: CostRisk | 'all'
  profitability: ProfitabilityState | 'all'
  search: string
}

type OptionItem = {
  id: string
  name: string
}

type ProductOption = {
  id: string
  name: string
  categoryId: string
  categoryName: string
  unit: string
  unitCost: number
}

type RecipeOption = {
  id: string
  code: string
  name: string
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  firePercent: number
  ingredients: Array<{ name: string; quantity: number; unit: string; unitCost: number }>
}

type LineOption = {
  id: string
  code: string
  name: string
  workCenter: string
  branchId: string
  utilization: number
}

type ProductionOrderOption = {
  id: string
  no: string
  branchId: string
  branchName: string
  productName: string
  plannedQuantity: number
  deliveryDate: string
}

type RawMaterialBreakdown = {
  id: string
  name: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
  percent: number
}

type RawMaterialOption = {
  id: string
  name: string
  unit: string
  unitCost: number
}

type PurchaseHistoryItem = {
  id: string
  label: string
  supplierName: string
  unitCost: number
  expectedSaving: number
  createdAt: string
}

type CostAnalyticsRecord = {
  id: string
  analysisNo: string
  productId: string
  productName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  categoryId: string
  categoryName: string
  branchId: string
  branchName: string
  lineId: string
  lineCode: string
  lineName: string
  workCenter: string
  productionOrderId: string
  productionOrderNo: string
  plannedQuantityKg: number
  unitCost: number
  totalCost: number
  laborCost: number
  rawMaterialCost: number
  energyCost: number
  wasteImpact: number
  shipmentImpact: number
  profitabilityPercent: number
  profitabilityAmount: number
  profitabilityLabel: ProfitabilityState
  expectedSaving: number
  risk: CostRisk
  riskScore: number
  createdAt: string
  calculationDate: string
  costComponents: CostComponent[]
  rawMaterials: RawMaterialBreakdown[]
  purchaseHistory: PurchaseHistoryItem[]
  aiSuggestions: string[]
  sourceSummary: string
}

type CostAnalyticsKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type CostAnalyticsModel = {
  sourceData: KpiSourceData
  records: CostAnalyticsRecord[]
  costOptimizationItems: CostOptimizationItem[]
  purchaseItems: PurchaseRecommendationItem[]
  wasteRecords: WasteRecord[]
  decisionSuggestions: DecisionSuggestion[]
  aiInsights: AIInsight[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const RECORD_COUNT = 800
const PRODUCTION_ORDER_COUNT = 250
const RECIPE_COUNT = 120
const PRODUCT_COUNT = 80
const RAW_MATERIAL_COUNT = 40
const SAVING_SCENARIO_COUNT = 30
const PROFITABILITY_ANALYSIS_COUNT = 50

const RISK_LABELS: Record<CostRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

const PROFITABILITY_OPTIONS: ProfitabilityState[] = ['Karlı', 'Düşük Marj', 'Zarar Riski']

const PRODUCT_FALLBACKS = [
  'Izgara Tavuk Fileto',
  'Dana Kavurma',
  'Etli Nohut',
  'Zeytinyağlı Taze Fasulye',
  'Mercimek Çorbası',
  'Ezogelin Çorbası',
  'Sebzeli Bulgur Pilavı',
  'Pirinç Pilavı',
  'Fırın Köfte',
  'Patates Püresi',
  'Tavuk Sote',
  'Dana Tas Kebabı',
  'Mevsim Salata',
  'Yoğurtlu Semizotu',
  'Peynirli Börek',
  'Ispanak Graten',
  'Karnıyarık',
  'Sebzeli Makarna',
  'Domates Sos',
  'Tavuk Haşlama',
  'Et Suyu Bazı',
  'Sebze Garnitür',
  'Mantar Sote',
  'Kırmızı Mercimek Köftesi',
  'Tavuk Döner Harcı',
  'Dana Rosto',
  'Çoban Salata',
  'Ayran Dolum',
  'Sütlaç',
  'Kakaolu Puding',
  'Komposto',
  'Kremalı Mantar Çorbası',
  'Fırın Tavuk But',
  'Sebzeli Hindi',
  'Kuru Fasulye',
  'Barbunya Pilaki',
  'Elmalı Kurabiye',
  'Kabak Tatlısı',
  'Limonata Bazı',
  'Paketli Sandviç'
]

const RAW_MATERIAL_FALLBACKS = [
  'Tavuk Göğüs',
  'Dana Kuşbaşı',
  'Pirinç',
  'Bulgur',
  'Kırmızı Mercimek',
  'Nohut',
  'Kuru Fasulye',
  'Taze Fasulye',
  'Domates',
  'Biber',
  'Soğan',
  'Patates',
  'Havuç',
  'Yoğurt',
  'Süt',
  'Un',
  'Tereyağı',
  'Ayçiçek Yağı',
  'Zeytinyağı',
  'Salça',
  'Krema',
  'Mantar',
  'Peynir',
  'Yumurta',
  'Tavuk But',
  'Hindi Eti',
  'Elma',
  'Kabak',
  'Limon',
  'Makarna',
  'Yeşillik',
  'Baharat Karışımı',
  'Kıyma',
  'Yufka',
  'Kakao',
  'Şeker',
  'Paketleme Kabı',
  'Vakum Poşeti',
  'Koli',
  'Etiket'
]

const CATEGORY_FALLBACKS = [
  'Sıcak Yemek',
  'Et Ürünleri',
  'Tavuk Ürünleri',
  'Sebze Hazırlık',
  'Çorba',
  'Bakliyat',
  'Soğuk Mutfak',
  'Tatlı',
  'Paketleme',
  'Sos ve Baz'
]

const LINE_FALLBACKS = [
  'Sıcak Yemek Hattı 1',
  'Sıcak Yemek Hattı 2',
  'Et Hazırlık Hattı',
  'Tavuk Hazırlık Hattı',
  'Sebze Hazırlık Hattı',
  'Çorba Hattı',
  'Tatlı ve Pasta Hattı',
  'Soğuk Mutfak Hattı',
  'Paketleme Hattı 1',
  'Paketleme Hattı 2',
  'Diyet Menü Hattı',
  'Vakum Paketleme',
  'Fırın Hattı',
  'Blast Chiller Hattı',
  'Garnitür Hattı',
  'Sos Hazırlık Hattı',
  'Bakliyat Hattı',
  'Sandviç Hattı',
  'Kahvaltı Hattı',
  'Sevkiyat Hazırlık Hattı'
]

const WORK_CENTERS = ['Sıcak Mutfak', 'Soğuk Mutfak', 'Hazırlık', 'Paketleme', 'Sevkiyat Hazırlık']

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(toFiniteNumber(value, min), min), max)

const sanitizeMoney = (value: number, min = 0, max = 2_500_000) => roundKpi(clamp(value, min, max))

const toDateKey = (value: unknown, fallback = '') => {
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('sv-SE')
  const text = normalizeText(value)
  if(!text) return fallback
  if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value: unknown, fallback?: unknown) => {
  const parseCandidate = (candidate: unknown) => {
    if(candidate instanceof Date) return Number.isNaN(candidate.getTime()) ? null : candidate
    const text = normalizeText(candidate)
    if(!text) return null
    const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return parseCandidate(value) || parseCandidate(fallback)
}

const formatDate = (value: unknown) => {
  const date = parseSafeDate(value)
  return date ? date.toLocaleDateString('tr-TR') : '-'
}

const formatDateTime = (value: unknown) => {
  const date = parseSafeDate(value)
  return date
    ? date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
    : '-'
}

const createUniqueOptions = (options: OptionItem[]) => {
  const seen = new Set<string>()
  return options
    .filter(option => option.id && option.name)
    .filter(option => {
      if(seen.has(option.id)) return false
      seen.add(option.id)
      return true
    })
    .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))
}

const safeList = <T,>(factory: () => T[]) => {
  try {
    return factory()
  } catch {
    return []
  }
}

const pickBranch = (sourceData: KpiSourceData, index: number, branchId = '') => (
  sourceData.branches.find(branch => branch.id === branchId)
  || sourceData.branches[index % Math.max(sourceData.branches.length, 1)]
  || {
    id: `branch-${index + 1}`,
    name: `Merkez Şube ${index + 1}`
  }
)

const createProductPool = (
  sourceData: KpiSourceData,
  costRecords: CostEngine[]
): ProductOption[] => {
  const categoryById = new Map(sourceData.stockItems.map(item => [item.categoryId, item.categoryId]))
  const fromCost = costRecords.map(record => ({
    id: record.productId || record.id,
    name: record.productName || record.recipeName,
    categoryId: record.categoryId || `category-${record.productId}`,
    categoryName: record.categoryName || CATEGORY_FALLBACKS[0],
    unit: 'kg',
    unitCost: clamp(record.costPerKg || record.costPerUnit || record.averageCost, 12, 650)
  }))
  const fromRefs = sourceData.productRefs.map((ref, index) => {
    const stockItem = sourceData.stockItems.find(item => item.id === ref.stockItemId)
    return {
      id: ref.id,
      name: ref.name,
      categoryId: stockItem?.categoryId || `category-${index % CATEGORY_FALLBACKS.length}`,
      categoryName: stockItem?.categoryId || CATEGORY_FALLBACKS[index % CATEGORY_FALLBACKS.length],
      unit: ref.unit,
      unitCost: clamp(stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || 35 + (index % 24) * 7, 10, 520)
    }
  })
  const fromStock = sourceData.stockItems.map((item, index) => ({
    id: item.id,
    name: item.name,
    categoryId: item.categoryId || `stock-category-${index % CATEGORY_FALLBACKS.length}`,
    categoryName: categoryById.get(item.categoryId) || CATEGORY_FALLBACKS[index % CATEGORY_FALLBACKS.length],
    unit: item.unit,
    unitCost: clamp(item.averageCost || item.lastPurchasePrice || item.unitPurchasePrice || 22 + (index % 18) * 5, 8, 480)
  }))

  const combined = createUniqueOptions([...fromCost, ...fromRefs, ...fromStock].map(item => ({ id: item.id, name: item.name })))
    .map(option => [...fromCost, ...fromRefs, ...fromStock].find(item => item.id === option.id))
    .filter((item): item is ProductOption => Boolean(item))

  const pool = [...combined]
  Array.from({ length: PRODUCT_COUNT }).forEach((_, index) => {
    if(pool.length > index) return
    const name = PRODUCT_FALLBACKS[index % PRODUCT_FALLBACKS.length]
    pool.push({
      id: `cost-product-${index + 1}`,
      name: `${name} ${Math.floor(index / PRODUCT_FALLBACKS.length) + 1}`,
      categoryId: `cost-category-${index % CATEGORY_FALLBACKS.length}`,
      categoryName: CATEGORY_FALLBACKS[index % CATEGORY_FALLBACKS.length],
      unit: 'kg',
      unitCost: 28 + (index % 26) * 6
    })
  })

  return pool.slice(0, PRODUCT_COUNT)
}

const createRecipePool = (
  sourceData: KpiSourceData,
  products: ProductOption[],
  costRecords: CostEngine[]
): RecipeOption[] => {
  const recipeById = new Map(sourceData.recipeRecords.map(recipe => [recipe.id, recipe]))
  const fromCost: RecipeOption[] = costRecords.map((record, index) => {
    const product = products.find(item => item.id === record.productId) || products[index % products.length]
    const recipe = recipeById.get(record.recipeId)
    return {
      id: record.recipeId || `cost-recipe-${index + 1}`,
      code: record.recipeCode || `RC-${String(index + 1).padStart(4, '0')}`,
      name: record.recipeName || recipe?.recipeName || `${product.name} Reçetesi`,
      productId: product.id,
      productName: product.name,
      categoryId: record.categoryId || product.categoryId,
      categoryName: record.categoryName || product.categoryName,
      firePercent: clamp(record.firePercent || recipe?.firePercent || 2 + (index % 9) * 0.35, 0.5, 12),
      ingredients: (recipe?.ingredients || []).map(ingredient => ({
        name: ingredient.materialName,
        quantity: ingredient.baseQuantity || ingredient.quantity,
        unit: ingredient.baseUnit || ingredient.unit,
        unitCost: clamp(ingredient.unitCost, 2, 650)
      }))
    }
  })
  const fromRecipes: RecipeOption[] = sourceData.recipeRecords.map((recipe, index) => {
    const product = products.find(item => normalizeSearchText(item.name) === normalizeSearchText(recipe.productName)) || products[index % products.length]
    return {
      id: recipe.id,
      code: recipe.code,
      name: recipe.recipeName,
      productId: product.id,
      productName: recipe.productName || product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      firePercent: clamp(recipe.firePercent, 0.5, 12),
      ingredients: recipe.ingredients.map(ingredient => ({
        name: ingredient.materialName,
        quantity: ingredient.baseQuantity || ingredient.quantity,
        unit: ingredient.baseUnit || ingredient.unit,
        unitCost: clamp(ingredient.unitCost, 2, 650)
      }))
    }
  })

  const combined: RecipeOption[] = createUniqueOptions([...fromCost, ...fromRecipes].map(item => ({ id: item.id, name: item.name })))
    .map(option => [...fromCost, ...fromRecipes].find(item => item.id === option.id))
    .filter((item): item is RecipeOption => Boolean(item))

  const pool: RecipeOption[] = [...combined]
  Array.from({ length: RECIPE_COUNT }).forEach((_, index) => {
    if(pool.length > index) return
    const product = products[index % products.length]
    pool.push({
      id: `cost-recipe-${index + 1}`,
      code: `RC-${String(index + 1).padStart(4, '0')}`,
      name: `${product.name} Standart Reçete`,
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      categoryName: product.categoryName,
      firePercent: 1.8 + (index % 12) * 0.45,
      ingredients: [
        { name: RAW_MATERIAL_FALLBACKS[index % RAW_MATERIAL_FALLBACKS.length], quantity: 120, unit: 'kg', unitCost: 42 + (index % 10) * 8 },
        { name: RAW_MATERIAL_FALLBACKS[(index + 7) % RAW_MATERIAL_FALLBACKS.length], quantity: 36, unit: 'kg', unitCost: 18 + (index % 8) * 5 },
        { name: RAW_MATERIAL_FALLBACKS[(index + 13) % RAW_MATERIAL_FALLBACKS.length], quantity: 14, unit: 'kg', unitCost: 24 + (index % 11) * 4 }
      ]
    })
  })

  return pool.slice(0, RECIPE_COUNT)
}

const createLinePool = (
  sourceData: KpiSourceData
): LineOption[] => {
  const fromLines: LineOption[] = sourceData.productionLines.map((line, index) => {
    const branch = pickBranch(sourceData, index)
    return {
      id: line.id,
      code: line.code,
      name: line.name,
      workCenter: line.type,
      branchId: branch.id,
      utilization: clamp(line.estimatedUtilization, 35, 98)
    }
  })
  const pool: LineOption[] = [...fromLines]
  Array.from({ length: LINE_FALLBACKS.length }).forEach((_, index) => {
    if(pool.length > index) return
    const branch = pickBranch(sourceData, index)
    pool.push({
      id: `cost-line-${index + 1}`,
      code: `HAT-${String(index + 1).padStart(2, '0')}`,
      name: LINE_FALLBACKS[index],
      workCenter: WORK_CENTERS[index % WORK_CENTERS.length],
      branchId: branch.id,
      utilization: 48 + (index % 12) * 4
    })
  })
  return pool
}

const createProductionOrderPool = (
  sourceData: KpiSourceData,
  products: ProductOption[]
): ProductionOrderOption[] => {
  const branchByName = new Map(sourceData.branches.map(branch => [normalizeSearchText(branch.name), branch]))
  const fromOrders = sourceData.productionOrders.map((order, index) => {
    const product = products.find(item => order.lines.some(line => normalizeSearchText(line.productName) === normalizeSearchText(item.name))) || products[index % products.length]
    const branch = branchByName.get(normalizeSearchText(order.branch)) || pickBranch(sourceData, index)
    return {
      id: order.id,
      no: order.workOrderNo,
      branchId: branch.id,
      branchName: branch.name,
      productName: product.name,
      plannedQuantity: clamp(sumBy(order.lines, line => line.quantity), 80, 5200),
      deliveryDate: toDateKey(order.deliveryDate) || toDateKey(addDays(new Date(), index % 30))
    }
  })
  const pool = [...fromOrders]
  Array.from({ length: PRODUCTION_ORDER_COUNT }).forEach((_, index) => {
    if(pool.length > index) return
    const product = products[index % products.length]
    const branch = pickBranch(sourceData, index)
    pool.push({
      id: `cost-work-order-${index + 1}`,
      no: `UE-${String(index + 1).padStart(5, '0')}`,
      branchId: branch.id,
      branchName: branch.name,
      productName: product.name,
      plannedQuantity: 180 + (index % 38) * 85,
      deliveryDate: toDateKey(addDays(new Date(), -(index % 45)))
    })
  })
  return pool.slice(0, PRODUCTION_ORDER_COUNT)
}

const createRawMaterialPool = (sourceData: KpiSourceData): RawMaterialOption[] => {
  const fromStock: RawMaterialOption[] = sourceData.stockItems.map((item, index) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    unitCost: clamp(item.averageCost || item.lastPurchasePrice || item.unitPurchasePrice || 18 + (index % 16) * 4, 2, 650)
  }))
  const fromRecipes: RawMaterialOption[] = sourceData.recipeRecords.flatMap((recipe, recipeIndex) => recipe.ingredients.map((ingredient, index) => ({
    id: `${recipe.id}-ingredient-${index}`,
    name: ingredient.materialName,
    unit: ingredient.baseUnit || ingredient.unit,
    unitCost: clamp(ingredient.unitCost || 10 + ((recipeIndex + index) % 18) * 4, 2, 650)
  })))
  const combined: RawMaterialOption[] = createUniqueOptions([...fromStock, ...fromRecipes].map(item => ({ id: item.id, name: item.name })))
    .map(option => [...fromStock, ...fromRecipes].find(item => item.id === option.id))
    .filter((item): item is RawMaterialOption => Boolean(item))
  const pool: RawMaterialOption[] = [...combined]
  Array.from({ length: RAW_MATERIAL_COUNT }).forEach((_, index) => {
    if(pool.length > index) return
    pool.push({
      id: `cost-raw-material-${index + 1}`,
      name: RAW_MATERIAL_FALLBACKS[index % RAW_MATERIAL_FALLBACKS.length],
      unit: index % 5 === 0 ? 'adet' : 'kg',
      unitCost: 9 + (index % 28) * 7
    })
  })
  return pool.slice(0, RAW_MATERIAL_COUNT)
}

const createRawMaterialBreakdown = (
  recipe: RecipeOption,
  rawMaterialPool: ReturnType<typeof createRawMaterialPool>,
  rawMaterialCost: number,
  index: number
): RawMaterialBreakdown[] => {
  const ingredients = recipe.ingredients.length > 0
    ? recipe.ingredients.slice(0, 5).map((ingredient, ingredientIndex) => ({
      id: `${recipe.id}-ingredient-${ingredientIndex}`,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: clamp(ingredient.quantity, 1, 1200),
      unitCost: clamp(ingredient.unitCost, 2, 650)
    }))
    : Array.from({ length: 4 }).map((_, ingredientIndex) => {
      const material = rawMaterialPool[(index + ingredientIndex * 7) % rawMaterialPool.length] || {
        id: `cost-raw-material-fallback-${ingredientIndex}`,
        name: RAW_MATERIAL_FALLBACKS[ingredientIndex % RAW_MATERIAL_FALLBACKS.length],
        unit: 'kg',
        unitCost: 25
      }
      return {
        id: material.id,
        name: material.name,
        unit: material.unit,
        quantity: 18 + ingredientIndex * 11 + (index % 8),
        unitCost: material.unitCost
      }
    })
  const totalWeight = sumBy(ingredients, ingredient => ingredient.quantity) || 1

  return ingredients.map((ingredient, ingredientIndex) => {
    const weightShare = ingredient.quantity / totalWeight
    const totalCost = sanitizeMoney(rawMaterialCost * weightShare, 1, rawMaterialCost)
    return {
      id: `${recipe.id}-raw-${ingredientIndex}`,
      name: ingredient.name,
      quantity: roundKpi(ingredient.quantity),
      unit: ingredient.unit,
      unitCost: roundKpi(ingredient.unitCost),
      totalCost,
      percent: percent(totalCost, rawMaterialCost)
    }
  })
}

const componentAmount = (record: CostEngine | undefined, types: CostComponent['type'][]) => (
  sumBy(record?.breakdown?.components || [], component => types.includes(component.type) ? component.amount : 0)
)

const createPurchaseHistory = (
  product: ProductOption,
  purchaseItems: PurchaseRecommendationItem[],
  index: number
): PurchaseHistoryItem[] => {
  const matched = purchaseItems.filter(item => (
    item.productId === product.id
    || item.stockItemId === product.id
    || normalizeSearchText(item.productName) === normalizeSearchText(product.name)
    || normalizeSearchText(item.stockItemName) === normalizeSearchText(product.name)
  ))
  const source = matched.length > 0 ? matched : purchaseItems.slice(index % Math.max(purchaseItems.length, 1), index % Math.max(purchaseItems.length, 1) + 3)

  return source.slice(0, 3).map((item, itemIndex) => ({
    id: item.id,
    label: item.recommendationNo || item.reportNo || `SAT-${index + itemIndex + 1}`,
    supplierName: item.supplierName || item.alternativeSupplierName || 'Onaylı Tedarikçi',
    unitCost: clamp(item.unitCost, 2, 650),
    expectedSaving: sanitizeMoney(item.expectedSaving, 0, 250_000),
    createdAt: item.createdAt
  }))
}

const createAiSuggestions = (
  recordSeed: {
    product: ProductOption
    recipe: RecipeOption
    risk: CostRisk
    expectedSaving: number
  },
  aiInsights: AIInsight[],
  optimizationItems: CostOptimizationItem[],
  decisionSuggestions: DecisionSuggestion[],
  index: number
) => {
  const matchedInsights = aiInsights
    .filter(insight => (
      insight.relatedEntityId === recordSeed.product.id
      || insight.categoryId === recordSeed.product.categoryId
      || normalizeSearchText(insight.relatedEntityName).includes(normalizeSearchText(recordSeed.product.name))
    ))
    .slice(0, 2)
    .map(insight => insight.recommendedAction || insight.summary || insight.title)
  const matchedOptimization = optimizationItems
    .filter(item => item.productId === recordSeed.product.id || item.category === recordSeed.recipe.categoryName)
    .slice(0, 2)
    .map(item => item.action || item.expectedImpact || item.title)
  const matchedDecision = decisionSuggestions
    .filter(suggestion => suggestion.relatedProductId === recordSeed.product.id || suggestion.category === 'Purchasing' || suggestion.category === 'Management')
    .slice(0, 2)
    .map(suggestion => suggestion.recommendation.action || suggestion.title)
  const fallback = [
    `${recordSeed.product.name} için hammadde fiyat sapması haftalık bazda izlenmeli.`,
    `${recordSeed.recipe.name} reçetesinde fire toleransı ve porsiyon standardı birlikte doğrulanmalı.`,
    `${formatCurrency(recordSeed.expectedSaving)} seviyesindeki tasarruf fırsatı satın alma ve üretim planı ile gözden geçirilmeli.`,
    recordSeed.risk === 'CRITICAL'
      ? 'Kritik maliyet riski nedeniyle üretim öncesi fiyat, fire ve işçilik varsayımları yeniden teyit edilmeli.'
      : 'Mevcut analiz salt okunur karar desteği olarak izlenebilir.'
  ]

  return [...matchedInsights, ...matchedOptimization, ...matchedDecision, ...fallback]
    .filter(Boolean)
    .slice(index % 2, index % 2 + 4)
}

const getRisk = (
  profitabilityPercent: number,
  wasteImpactPercent: number,
  purchaseImpactPercent: number,
  totalCost: number,
  savingPercent: number
): { risk: CostRisk; riskScore: number } => {
  const marginPenalty = profitabilityPercent < 0 ? 38 : profitabilityPercent < 8 ? 26 : profitabilityPercent < 15 ? 14 : 4
  const wastePenalty = wasteImpactPercent > 8 ? 24 : wasteImpactPercent > 4 ? 14 : 5
  const purchasePenalty = purchaseImpactPercent > 12 ? 18 : purchaseImpactPercent > 7 ? 10 : 4
  const costPenalty = totalCost > 1_400_000 ? 12 : totalCost > 700_000 ? 7 : 2
  const savingPenalty = savingPercent > 15 ? 9 : savingPercent > 8 ? 5 : 1
  const riskScore = clamp(marginPenalty + wastePenalty + purchasePenalty + costPenalty + savingPenalty, 0, 100)

  if(riskScore >= 82) return { risk: 'CRITICAL', riskScore }
  if(riskScore >= 62) return { risk: 'HIGH', riskScore }
  if(riskScore >= 38) return { risk: 'MEDIUM', riskScore }
  return { risk: 'LOW', riskScore }
}

const createRecords = (
  sourceData: KpiSourceData,
  costRecords: CostEngine[],
  optimizationItems: CostOptimizationItem[],
  purchaseItems: PurchaseRecommendationItem[],
  wasteRecords: WasteRecord[],
  decisionSuggestions: DecisionSuggestion[],
  aiInsights: AIInsight[]
) => {
  const products = createProductPool(sourceData, costRecords)
  const recipes = createRecipePool(sourceData, products, costRecords)
  const lines = createLinePool(sourceData)
  const productionOrders = createProductionOrderPool(sourceData, products)
  const rawMaterialPool = createRawMaterialPool(sourceData)
  const referenceDate = new Date()

  return Array.from({ length: RECORD_COUNT }).map((_, index): CostAnalyticsRecord => {
    const sourceCost = costRecords[index % Math.max(costRecords.length, 1)]
    const sourceProduct = sourceCost
      ? products.find(product => product.id === sourceCost.productId)
      : undefined
    const product = sourceProduct || products[index % products.length]
    const sourceRecipe = sourceCost
      ? recipes.find(recipe => recipe.id === sourceCost.recipeId)
      : undefined
    const recipe = sourceRecipe || recipes.find(item => item.productId === product.id) || recipes[index % recipes.length]
    const line = lines[index % lines.length]
    const order = productionOrders[index % productionOrders.length]
    const branch = pickBranch(sourceData, index, sourceCost?.branchId || order.branchId || line.branchId)
    const dateKey = toDateKey(sourceCost?.calculationDate || order.deliveryDate || addDays(referenceDate, -(index % 60)))
      || toDateKey(addDays(referenceDate, -(index % 60)))
    const plannedQuantityKg = clamp(order.plannedQuantity + (index % 17) * 18, 90, 5400)
    const sourceUnitCost = sourceCost
      ? sourceCost.costPerKg || sourceCost.costPerUnit || sourceCost.averageCost || sourceCost.totalCost / Math.max(plannedQuantityKg, 1)
      : product.unitCost
    const unitCostSeed = clamp(sourceUnitCost * (0.88 + (index % 19) * 0.018), 14, 680)
    const baseTotalCost = sanitizeMoney(unitCostSeed * plannedQuantityKg, 2_500, 2_100_000)
    const wasteRecord = wasteRecords.find(record => record.productId === product.id || normalizeSearchText(record.productName) === normalizeSearchText(product.name))
    const rawMaterialPercent = clamp(sourceCost?.breakdown?.rawMaterialPercent || 48 + (index % 12) * 2.3, 42, 72)
    const laborPercent = clamp(sourceCost?.breakdown?.laborPercent || 11 + (index % 8) * 1.2, 8, 22)
    const energyPercent = clamp((sourceCost?.breakdown?.blastChillingPercent || 3) + 2.5 + (index % 5) * 0.7, 3, 12)
    const shipmentPercent = clamp(sourceCost?.breakdown?.shipmentPercent || 2.5 + (index % 6) * 0.8, 2, 10)
    const wasteImpactPercent = clamp(sourceCost?.breakdown?.firePercent || recipe.firePercent + (index % 7) * 0.35, 1, 14)
    const rawMaterialCost = sanitizeMoney(baseTotalCost * rawMaterialPercent / 100, 500, baseTotalCost)
    const laborCost = sanitizeMoney(baseTotalCost * laborPercent / 100, 200, baseTotalCost)
    const energyCost = sanitizeMoney(baseTotalCost * energyPercent / 100, 120, baseTotalCost)
    const shipmentImpact = sanitizeMoney(baseTotalCost * shipmentPercent / 100, 80, baseTotalCost)
    const wasteImpactSource = sourceCost?.fireImpact || wasteRecord?.totalCost || baseTotalCost * wasteImpactPercent / 100
    const wasteImpact = sanitizeMoney(wasteImpactSource * (0.7 + (index % 6) * 0.08), 50, baseTotalCost * 0.18)
    const totalCost = sanitizeMoney(rawMaterialCost + laborCost + energyCost + shipmentImpact + wasteImpact, 3_000, 2_400_000)
    const unitCost = roundKpi(totalCost / Math.max(plannedQuantityKg, 1))
    const marginSeed = index < PROFITABILITY_ANALYSIS_COUNT
      ? [-6, 4, 8, 12, 18, 24, 31][index % 7]
      : 14 + (index % 18)
    const salesRevenue = sanitizeMoney(totalCost * (1 + marginSeed / 100), 2_000, 3_100_000)
    const profitabilityAmount = roundKpi(salesRevenue - totalCost)
    const profitabilityPercent = roundKpi(percent(profitabilityAmount, Math.max(salesRevenue, 1)))
    const profitabilityLabel: ProfitabilityState = profitabilityPercent < 5 ? 'Zarar Riski' : profitabilityPercent < 15 ? 'Düşük Marj' : 'Karlı'
    const optimization = optimizationItems[index % Math.max(optimizationItems.length, 1)]
    const expectedSavingSeed = optimization?.savingPotential || optimization?.expectedMonthlyGain || totalCost * (0.04 + (index % 11) * 0.012)
    const expectedSaving = sanitizeMoney(
      index < SAVING_SCENARIO_COUNT ? Math.max(expectedSavingSeed, totalCost * 0.16) : expectedSavingSeed,
      0,
      totalCost * 0.28
    )
    const purchaseImpactPercent = percent(sourceCost?.purchaseImpact || componentAmount(sourceCost, ['PURCHASING']), totalCost)
    const savingPercent = percent(expectedSaving, totalCost)
    const { risk, riskScore } = getRisk(profitabilityPercent, wasteImpactPercent, purchaseImpactPercent, totalCost, savingPercent)
    const rawMaterials = createRawMaterialBreakdown(recipe, rawMaterialPool, rawMaterialCost, index)
    const purchaseHistory = createPurchaseHistory(product, purchaseItems, index)
    const aiSuggestions = createAiSuggestions({ product, recipe, risk, expectedSaving }, aiInsights, optimizationItems, decisionSuggestions, index)
    const costComponents = sourceCost?.breakdown?.components?.length
      ? sourceCost.breakdown.components
      : [
        { id: `${index}-raw`, type: 'RAW_MATERIAL', label: 'Hammadde', amount: rawMaterialCost, percent: percent(rawMaterialCost, totalCost), source: 'Recipe', sourceId: recipe.id, note: recipe.name },
        { id: `${index}-labor`, type: 'LABOR', label: 'İşçilik', amount: laborCost, percent: percent(laborCost, totalCost), source: 'Production', sourceId: order.id, note: order.no },
        { id: `${index}-energy`, type: 'OTHER', label: 'Enerji', amount: energyCost, percent: percent(energyCost, totalCost), source: 'Estimated', sourceId: line.id, note: line.name },
        { id: `${index}-waste`, type: 'WASTE', label: 'Fire Etkisi', amount: wasteImpact, percent: percent(wasteImpact, totalCost), source: 'Waste', sourceId: wasteRecord?.id || '', note: wasteRecord?.wasteNo || 'Tahmini fire etkisi' },
        { id: `${index}-shipment`, type: 'SHIPMENT', label: 'Sevkiyat Etkisi', amount: shipmentImpact, percent: percent(shipmentImpact, totalCost), source: 'Shipment', sourceId: '', note: 'Dağıtım gider payı' }
      ] as CostComponent[]

    return {
      id: `cost-analytics-${index + 1}`,
      analysisNo: `MA-${String(index + 1).padStart(5, '0')}`,
      productId: product.id,
      productName: product.name,
      recipeId: recipe.id,
      recipeCode: recipe.code,
      recipeName: recipe.name,
      categoryId: recipe.categoryId || product.categoryId,
      categoryName: recipe.categoryName || product.categoryName,
      branchId: branch.id,
      branchName: branch.name,
      lineId: line.id,
      lineCode: line.code,
      lineName: line.name,
      workCenter: line.workCenter,
      productionOrderId: order.id,
      productionOrderNo: order.no,
      plannedQuantityKg,
      unitCost,
      totalCost,
      laborCost,
      rawMaterialCost,
      energyCost,
      wasteImpact,
      shipmentImpact,
      profitabilityPercent,
      profitabilityAmount,
      profitabilityLabel,
      expectedSaving,
      risk,
      riskScore,
      createdAt: new Date(`${dateKey}T${String(8 + (index % 10)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00`).toISOString(),
      calculationDate: dateKey,
      costComponents,
      rawMaterials,
      purchaseHistory,
      aiSuggestions,
      sourceSummary: sourceCost ? `Cost Engine / ${sourceCost.recipeCode}` : 'Cost Engine read-model'
    }
  })
}

const createModel = (): CostAnalyticsModel => {
  const sourceData = loadKpiSourceData()
  const costView = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const costOptimizationItems = safeList(() => CostOptimizationService.list(sourceData).flatMap(report => report.items))
  const purchaseItems = safeList(() => PurchaseRecommendationService.list(sourceData).flatMap(report => report.items))
  const wasteRecords = safeList(() => WasteService.list(sourceData))
  const decisionSuggestions = safeList(() => createDecisionSuggestions(sourceData))
    .filter(suggestion => ['Purchasing', 'Management', 'Inventory', 'Production'].includes(suggestion.category))
  const aiInsights = safeList(() => AIAnalysisService.list(sourceData).flatMap(report => report.insights))
    .filter(insight => ['OPPORTUNITY', 'EXPECTED_IMPACT', 'RISK', 'ANOMALY'].includes(insight.insightType))
  const records = createRecords(
    sourceData,
    costView.records,
    costOptimizationItems,
    purchaseItems,
    wasteRecords,
    decisionSuggestions,
    aiInsights
  )

  return {
    sourceData,
    records,
    costOptimizationItems,
    purchaseItems,
    wasteRecords,
    decisionSuggestions,
    aiInsights,
    generatedAt: new Date().toISOString()
  }
}

const createDefaultFilters = (records: CostAnalyticsRecord[]): CostAnalyticsFilters => {
  const dates = records.map(record => record.calculationDate).filter(Boolean).sort()
  const today = toDateKey(new Date())

  return {
    startDate: dates[0] || today,
    endDate: dates[dates.length - 1] || today,
    branchId: ALL_FILTER,
    productId: ALL_FILTER,
    categoryId: ALL_FILTER,
    recipeId: ALL_FILTER,
    lineId: ALL_FILTER,
    productionOrderId: ALL_FILTER,
    risk: ALL_FILTER,
    profitability: ALL_FILTER,
    search: ''
  }
}

const matchesFilter = (record: CostAnalyticsRecord, filters: CostAnalyticsFilters) => {
  const search = normalizeSearchText(filters.search)
  const searchable = [
    record.analysisNo,
    record.productName,
    record.recipeCode,
    record.recipeName,
    record.categoryName,
    record.branchName,
    record.lineName,
    record.productionOrderNo,
    record.profitabilityLabel,
    RISK_LABELS[record.risk]
  ].map(normalizeSearchText).join(' ')

  return (
    (!filters.startDate || record.calculationDate >= filters.startDate)
    && (!filters.endDate || record.calculationDate <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.categoryId === ALL_FILTER || record.categoryId === filters.categoryId)
    && (filters.recipeId === ALL_FILTER || record.recipeId === filters.recipeId)
    && (filters.lineId === ALL_FILTER || record.lineId === filters.lineId)
    && (filters.productionOrderId === ALL_FILTER || record.productionOrderId === filters.productionOrderId)
    && (filters.risk === ALL_FILTER || record.risk === filters.risk)
    && (filters.profitability === ALL_FILTER || record.profitabilityLabel === filters.profitability)
    && (!search || searchable.includes(search))
  )
}

const groupRecords = <TKey extends string>(
  records: CostAnalyticsRecord[],
  getKey: (record: CostAnalyticsRecord) => TKey,
  getLabel: (record: CostAnalyticsRecord) => string
) => records.reduce<Map<TKey, { label: string; records: CostAnalyticsRecord[] }>>((map, record) => {
  const key = getKey(record)
  const previous = map.get(key)
  map.set(key, {
    label: previous?.label || getLabel(record),
    records: [...(previous?.records || []), record]
  })
  return map
}, new Map())

const createKpis = (records: CostAnalyticsRecord[]): CostAnalyticsKpi[] => {
  const totalCost = sumBy(records, record => record.totalCost)
  const averageUnitCost = averageBy(records, record => record.unitCost)
  const totalSaving = sumBy(records, record => record.expectedSaving)
  const profitabilityIndex = averageBy(records, record => record.profitabilityPercent)
  const productGroups = Array.from(groupRecords(records, record => record.productId, record => record.productName).values())
  const mostProfitable = productGroups
    .map(group => ({
      label: group.label,
      profitability: averageBy(group.records, record => record.profitabilityPercent),
      amount: sumBy(group.records, record => record.profitabilityAmount)
    }))
    .sort((first, second) => second.profitability - first.profitability)[0]
  const highestCost = productGroups
    .map(group => ({
      label: group.label,
      total: sumBy(group.records, record => record.totalCost)
    }))
    .sort((first, second) => second.total - first.total)[0]

  return [
    {
      id: 'total-production-cost',
      label: 'Toplam Üretim Maliyeti',
      value: formatCurrency(totalCost),
      detail: `${formatNumber(records.length)} analiz kaydı`,
      tone: totalCost > 120_000_000 ? 'warning' : 'neutral'
    },
    {
      id: 'average-unit-cost',
      label: 'Ortalama Birim Maliyet',
      value: formatCurrency(averageUnitCost),
      detail: 'kg eşdeğer ortalama',
      tone: averageUnitCost > 260 ? 'warning' : 'success'
    },
    {
      id: 'most-profitable-product',
      label: 'En Karlı Ürün',
      value: mostProfitable?.label || '-',
      detail: mostProfitable ? `${formatPercent(mostProfitable.profitability)} / ${formatCurrency(mostProfitable.amount)}` : 'Kayıt yok',
      tone: 'success'
    },
    {
      id: 'highest-cost-product',
      label: 'En Yüksek Maliyetli Ürün',
      value: highestCost?.label || '-',
      detail: highestCost ? formatCurrency(highestCost.total) : 'Kayıt yok',
      tone: highestCost && highestCost.total > 18_000_000 ? 'warning' : 'neutral'
    },
    {
      id: 'expected-saving',
      label: 'Beklenen Tasarruf',
      value: formatCurrency(totalSaving),
      detail: `${formatPercent(percent(totalSaving, totalCost))} tasarruf potansiyeli`,
      tone: totalSaving > 0 ? 'success' : 'neutral'
    },
    {
      id: 'profitability-index',
      label: 'Karlılık Endeksi',
      value: formatPercent(profitabilityIndex),
      detail: `${formatNumber(records.filter(record => record.profitabilityLabel === 'Karlı').length)} karlı analiz`,
      tone: profitabilityIndex >= 18 ? 'success' : profitabilityIndex >= 10 ? 'warning' : 'danger'
    }
  ]
}

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string; formatter: (value: number) => string; tone?: KpiTone }>,
  limit = 8
): BarChartRow[] => rows
  .filter(row => row.id && row.label)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formatter(row.value),
    detail: row.detail,
    tone: row.tone
  }))

const aggregateSumRows = (
  records: CostAnalyticsRecord[],
  getKey: (record: CostAnalyticsRecord) => string,
  getLabel: (record: CostAnalyticsRecord) => string,
  getValue: (record: CostAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: roundKpi((previous?.total || 0) + getValue(record)),
      count: (previous?.count || 0) + 1
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    detail: `${formatNumber(row.count)} analiz / ${detailLabel}`,
    formatter
  })))
}

const aggregateAverageRows = (
  records: CostAnalyticsRecord[],
  getKey: (record: CostAnalyticsRecord) => string,
  getLabel: (record: CostAnalyticsRecord) => string,
  getValue: (record: CostAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    const key = getKey(record)
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: roundKpi((previous?.total || 0) + getValue(record)),
      count: (previous?.count || 0) + 1
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => {
    const average = row.count > 0 ? row.total / row.count : 0
    return {
      id,
      label: row.label,
      value: average,
      detail: `${formatNumber(row.count)} analiz / ${detailLabel}`,
      formatter,
      tone: average >= 18 ? 'success' as KpiTone : average >= 10 ? 'warning' as KpiTone : 'danger' as KpiTone
    }
  }))
}

const createDailyRows = (records: CostAnalyticsRecord[]) => {
  const map = records.reduce<Map<string, { cost: number; saving: number; count: number }>>((acc, record) => {
    const previous = acc.get(record.calculationDate) || { cost: 0, saving: 0, count: 0 }
    acc.set(record.calculationDate, {
      cost: roundKpi(previous.cost + record.totalCost),
      saving: roundKpi(previous.saving + record.expectedSaving),
      count: previous.count + 1
    })
    return acc
  }, new Map())

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([date, row]) => ({
      id: `daily-cost-${date}`,
      label: formatDate(date),
      value: row.cost,
      formattedValue: formatCurrency(row.cost),
      detail: `${formatNumber(row.count)} analiz / ${formatCurrency(row.saving)} tasarruf`
    }))
}

const createRawMaterialRows = (records: CostAnalyticsRecord[]) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number }>>((acc, record) => {
    record.rawMaterials.forEach(material => {
      const previous = acc.get(material.name)
      acc.set(material.name, {
        label: previous?.label || material.name,
        total: roundKpi((previous?.total || 0) + material.totalCost),
        count: (previous?.count || 0) + 1
      })
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    detail: `${formatNumber(row.count)} reçete kırılımı / hammadde maliyeti`,
    formatter: formatCurrency
  })))
}

const createChartGroups = (records: CostAnalyticsRecord[]) => [
  {
    id: 'daily-cost-trend',
    title: 'Günlük Maliyet Trendi',
    rows: createDailyRows(records)
  },
  {
    id: 'product-cost',
    title: 'Ürün Bazlı Maliyet',
    rows: aggregateSumRows(records, record => record.productId, record => record.productName, record => record.totalCost, formatCurrency, 'toplam maliyet')
  },
  {
    id: 'recipe-cost',
    title: 'Reçete Bazlı Maliyet',
    rows: aggregateSumRows(records, record => record.recipeId, record => record.recipeName, record => record.totalCost, formatCurrency, 'reçete maliyeti')
  },
  {
    id: 'raw-material-distribution',
    title: 'Hammadde Dağılımı',
    rows: createRawMaterialRows(records)
  },
  {
    id: 'labor-distribution',
    title: 'İşçilik Dağılımı',
    rows: aggregateSumRows(records, record => record.lineId, record => record.lineName, record => record.laborCost, formatCurrency, 'işçilik maliyeti')
  },
  {
    id: 'waste-impact',
    title: 'Fire Etkisi',
    rows: aggregateSumRows(records, record => record.productId, record => record.productName, record => record.wasteImpact, formatCurrency, 'fire etkisi')
  },
  {
    id: 'profitability-analysis',
    title: 'Karlılık Analizi',
    rows: aggregateAverageRows(records, record => record.categoryId, record => record.categoryName, record => record.profitabilityPercent, formatPercent, 'ortalama karlılık')
  },
  {
    id: 'saving-opportunities',
    title: 'Tasarruf Fırsatları',
    rows: aggregateSumRows(records, record => record.categoryId, record => record.categoryName, record => record.expectedSaving, formatCurrency, 'beklenen tasarruf')
  }
]

const createOptions = (
  records: CostAnalyticsRecord[],
  getId: (record: CostAnalyticsRecord) => string,
  getName: (record: CostAnalyticsRecord) => string
) => createUniqueOptions(records.map(record => ({ id: getId(record), name: getName(record) })))

const mapRowsForOutput = (rows: CostAnalyticsRecord[]) => rows.map(row => ({
  'Analiz No': row.analysisNo,
  Ürün: row.productName,
  Reçete: `${row.recipeCode} / ${row.recipeName}`,
  Kategori: row.categoryName,
  Şube: row.branchName,
  Hat: `${row.lineCode} / ${row.lineName}`,
  'Üretim Emri': row.productionOrderNo,
  'Birim Maliyet': row.unitCost,
  'Toplam Maliyet': row.totalCost,
  İşçilik: row.laborCost,
  Hammadde: row.rawMaterialCost,
  Enerji: row.energyCost,
  'Fire Etkisi': row.wasteImpact,
  'Sevkiyat Etkisi': row.shipmentImpact,
  Karlılık: row.profitabilityPercent,
  'Karlılık Tutarı': row.profitabilityAmount,
  Risk: RISK_LABELS[row.risk],
  'Beklenen Tasarruf': row.expectedSaving,
  'Oluşturulma Tarihi': formatDateTime(row.createdAt)
}))

const exportFilteredRows = (rows: CostAnalyticsRecord[]) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'cost-engine',
    moduleLabel: 'Maliyet Analizi',
    sheetName: 'Maliyet Analizi',
    fileNamePrefix: 'maliyet-analizi-filtreli',
    fileName: `maliyet-analizi-filtreli-${toDateKey(new Date())}.xlsx`,
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const openPrintWindow = (
  rows: CostAnalyticsRecord[],
  kpis: CostAnalyticsKpi[],
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if(!printWindow) return
  const kpiHtml = kpis.map(kpi => `
    <article>
      <span>${escapeHtml(kpi.label)}</span>
      <strong>${escapeHtml(kpi.value)}</strong>
      <small>${escapeHtml(kpi.detail)}</small>
    </article>
  `).join('')
  const tableRows = rows.slice(0, 140).map(row => `
    <tr>
      <td>${escapeHtml(row.analysisNo)}</td>
      <td>${escapeHtml(row.productName)}</td>
      <td>${escapeHtml(row.recipeName)}</td>
      <td>${escapeHtml(row.categoryName)}</td>
      <td>${escapeHtml(row.branchName)}</td>
      <td>${escapeHtml(row.lineName)}</td>
      <td>${escapeHtml(row.productionOrderNo)}</td>
      <td>${escapeHtml(formatCurrency(row.unitCost))}</td>
      <td>${escapeHtml(formatCurrency(row.totalCost))}</td>
      <td>${escapeHtml(formatCurrency(row.rawMaterialCost))}</td>
      <td>${escapeHtml(formatCurrency(row.laborCost))}</td>
      <td>${escapeHtml(formatPercent(row.profitabilityPercent))}</td>
      <td>${escapeHtml(RISK_LABELS[row.risk])}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Maliyet Analizi ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
          h1 { margin:0; font-size:24px; }
          p { margin:${PRINT_SPACING_VALUES.space4} 0 ${PRINT_SPACING_VALUES.space16}; color:${PRINT_THEME_COLORS.textMutedStrong}; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:${PRINT_SPACING_VALUES.space8}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
          article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:${PRINT_RADIUS_VALUES.card}; padding:${PRINT_SPACING_VALUES.space12}; page-break-inside:avoid; }
          article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
          article strong { display:block; margin:${PRINT_SPACING_VALUES.space4} 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:10.5px; }
          th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
          th { background:${PRINT_THEME_COLORS.pageBackground}; }
          @media print { body { padding:${PRINT_SPACING_VALUES.space16}; } }
        </style>
      </head>
      <body>
        <h1>Maliyet Analizi</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Analiz No</th><th>Ürün</th><th>Reçete</th><th>Kategori</th><th>Şube</th><th>Hat</th><th>Üretim Emri</th><th>Birim Maliyet</th><th>Toplam Maliyet</th><th>Hammadde</th><th>İşçilik</th><th>Karlılık</th><th>Risk</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="13">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function CostAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<CostAnalyticsFilters>(() => createDefaultFilters(model.records))
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const productOptions = React.useMemo(() => createOptions(model.records, record => record.productId, record => record.productName), [model.records])
  const categoryOptions = React.useMemo(() => createOptions(model.records, record => record.categoryId, record => record.categoryName), [model.records])
  const recipeOptions = React.useMemo(() => createOptions(model.records, record => record.recipeId, record => `${record.recipeCode} / ${record.recipeName}`), [model.records])
  const lineOptions = React.useMemo(() => createOptions(model.records, record => record.lineId, record => `${record.lineCode} / ${record.lineName}`), [model.records])
  const productionOrderOptions = React.useMemo(() => createOptions(model.records, record => record.productionOrderId, record => record.productionOrderNo), [model.records])

  const updateFilter = <TKey extends keyof CostAnalyticsFilters>(key: TKey, value: CostAnalyticsFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page cost-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Maliyet Analizi</h2>
          <p className="muted">Cost Engine, reçete maliyetleri, satın alma fiyatları, fire kayıtları, üretim emirleri, sevkiyat giderleri, AI analizi ve karar destek sinyallerini tek yönetici ekranında analiz eder.</p>
        </div>
        <div className="daily-production-actions">
          <button className="btn" type="button" onClick={() => exportFilteredRows(filteredRecords)}>Filtreli Excel</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PDF')}>Filtreli PDF</button>
          <button className="btn" type="button" onClick={() => openPrintWindow(filteredRecords, kpis, 'PRINT')}>Filtreli Yazdır</button>
        </div>
      </div>

      <div className="daily-production-meta">
        <span>Analiz: {formatDateTime(model.generatedAt)}</span>
        <span>Kullanıcı: {currentUser.fullName || currentUser.username}</span>
        <span>{formatNumber(model.records.length)} maliyet analizi</span>
        <span>{formatNumber(PRODUCTION_ORDER_COUNT)} üretim emri / {formatNumber(RECIPE_COUNT)} reçete / {formatNumber(PRODUCT_COUNT)} ürün / {formatNumber(RAW_MATERIAL_COUNT)} hammadde</span>
        <span>{formatNumber(SAVING_SCENARIO_COUNT)} tasarruf senaryosu / {formatNumber(PROFITABILITY_ANALYSIS_COUNT)} karlılık analizi / {formatNumber(model.aiInsights.length)} AI sinyali</span>
      </div>

      <div className="metric-grid daily-production-metric-grid">
        {kpis.map(kpi => (
          <div className={`metric-card kpi-card daily-production-metric ${kpi.tone}`} key={kpi.id}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.detail}</small>
          </div>
        ))}
      </div>

      <section className="card daily-production-filter-card">
        <div className="section-header compact">
          <div>
            <h3>Filtreler</h3>
            <p className="muted">{formatNumber(filteredRecords.length)} kayıt listeleniyor. Bu ekran muhasebe kaydı, stok hareketi, satın alma, üretim emri veya reçete değişikliği oluşturmaz.</p>
          </div>
          <button className="btn" type="button" onClick={() => setFilters(createDefaultFilters(model.records))}>Reset</button>
        </div>
        <div className="daily-production-filter-grid">
          <label className="form-field">
            <span>Başlangıç</span>
            <input type="date" value={filters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
          </label>
          <label className="form-field">
            <span>Bitiş</span>
            <input type="date" value={filters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
          </label>
          <FilterSelect label="Şube" value={filters.branchId} options={branchOptions} onChange={value => updateFilter('branchId', value)} />
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Kategori" value={filters.categoryId} options={categoryOptions} onChange={value => updateFilter('categoryId', value)} />
          <FilterSelect label="Reçete" value={filters.recipeId} options={recipeOptions} onChange={value => updateFilter('recipeId', value)} />
          <FilterSelect label="Hat" value={filters.lineId} options={lineOptions} onChange={value => updateFilter('lineId', value)} />
          <FilterSelect label="Üretim Emri" value={filters.productionOrderId} options={productionOrderOptions} onChange={value => updateFilter('productionOrderId', value)} />
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as CostAnalyticsFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Karlılık</span>
            <select value={filters.profitability} onChange={event => updateFilter('profitability', event.target.value as CostAnalyticsFilters['profitability'])}>
              <option value={ALL_FILTER}>Tüm Karlılık</option>
              {PROFITABILITY_OPTIONS.map(option => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Analiz no, ürün, reçete, kategori, şube, hat, üretim emri..." />
          </label>
        </div>
      </section>

      <section className="daily-production-chart-grid">
        {chartGroups.map(chart => <BarChartCard key={chart.id} title={chart.title} rows={chart.rows} />)}
      </section>

      <section className="daily-production-layout split-layout">
        <div className="card table-card daily-production-table-wrap">
          <div className="section-header compact">
            <div>
              <h3>Filtrelenmiş Liste</h3>
              <p className="muted">Analiz no, ürün, reçete, kategori, şube, hat, üretim emri, maliyet kırılımları, karlılık, risk ve oluşturulma tarihi.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table cost-analytics-table">
              <thead>
                <tr>
                  <th>Analiz No</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Kategori</th>
                  <th>Şube</th>
                  <th>Hat</th>
                  <th>Üretim Emri</th>
                  <th>Birim Maliyet</th>
                  <th>Toplam Maliyet</th>
                  <th>İşçilik</th>
                  <th>Hammadde</th>
                  <th>Enerji</th>
                  <th>Fire Etkisi</th>
                  <th>Sevkiyat Etkisi</th>
                  <th>Karlılık</th>
                  <th>Risk</th>
                  <th>Oluşturulma</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={17}>Filtrelere uygun maliyet analizi bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Analiz No"><strong>{record.analysisNo}</strong><span>{record.sourceSummary}</span></td>
                    <td data-label="Ürün"><strong>{record.productName}</strong><span>{formatNumber(record.plannedQuantityKg, 1)} kg plan</span></td>
                    <td data-label="Reçete"><strong>{record.recipeCode}</strong><span>{record.recipeName}</span></td>
                    <td data-label="Kategori">{record.categoryName}</td>
                    <td data-label="Şube">{record.branchName}</td>
                    <td data-label="Hat"><strong>{record.lineCode}</strong><span>{record.lineName}</span></td>
                    <td data-label="Üretim Emri">{record.productionOrderNo}</td>
                    <td data-label="Birim Maliyet">{formatCurrency(record.unitCost)}</td>
                    <td data-label="Toplam Maliyet">{formatCurrency(record.totalCost)}</td>
                    <td data-label="İşçilik">{formatCurrency(record.laborCost)}</td>
                    <td data-label="Hammadde">{formatCurrency(record.rawMaterialCost)}</td>
                    <td data-label="Enerji">{formatCurrency(record.energyCost)}</td>
                    <td data-label="Fire Etkisi">{formatCurrency(record.wasteImpact)}</td>
                    <td data-label="Sevkiyat Etkisi">{formatCurrency(record.shipmentImpact)}</td>
                    <td data-label="Karlılık"><strong>{formatPercent(record.profitabilityPercent)}</strong><span>{record.profitabilityLabel}</span></td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span></td>
                    <td data-label="Oluşturulma">{formatDate(record.calculationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <CostDetailPanel record={selectedRecord} />
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: OptionItem[]
  onChange: (value: string) => void
}){
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)}>
        <option value={ALL_FILTER}>Tümü</option>
        {options.map(option => <option value={option.id} key={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function BarChartCard({
  title,
  rows
}: {
  title: string
  rows: BarChartRow[]
}){
  const chartValues = rows.map(row => Math.max(0, toFiniteNumber(row.value)))
  const maxValue = Math.max(...chartValues, 1)

  return (
    <section className="card kpi-chart-card daily-production-chart-card">
      <div className="section-header compact">
        <h3>{title}</h3>
      </div>
      <div className="kpi-bar-list">
        {rows.length === 0 && <p className="muted">Grafik için uygun kayıt bulunamadı.</p>}
        {rows.map(row => (
          <div className="kpi-bar-row" key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <em>{row.formattedValue}</em>
            <div className="kpi-bar-track">
              <span style={{ width: `${clamp(percent(toFiniteNumber(row.value), maxValue), 4, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CostDetailPanel({
  record
}: {
  record: CostAnalyticsRecord | undefined
}){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-state">Detay için bir maliyet analizi seçin.</div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Maliyet Özeti</h3>
            <p className="muted">{record.analysisNo} / {record.productName}</p>
          </div>
          <span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Toplam Maliyet" value={formatCurrency(record.totalCost)} detail={`${formatNumber(record.plannedQuantityKg, 1)} kg plan`} />
          <DetailMetric label="Birim Maliyet" value={formatCurrency(record.unitCost)} detail="kg eşdeğer maliyet" />
          <DetailMetric label="Karlılık" value={formatPercent(record.profitabilityPercent)} detail={`${record.profitabilityLabel} / ${formatCurrency(record.profitabilityAmount)}`} />
          <DetailMetric label="Beklenen Tasarruf" value={formatCurrency(record.expectedSaving)} detail={`${formatPercent(percent(record.expectedSaving, record.totalCost))} potansiyel`} />
          <DetailMetric label="Risk Skoru" value={formatPercent(record.riskScore)} detail="maliyet, fire ve satın alma etkisi" />
          <DetailMetric label="Oluşturulma" value={formatDate(record.calculationDate)} detail={formatDateTime(record.createdAt)} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Reçete Dağılımı</h3>
        </div>
        <div className="daily-production-module-list">
          {record.costComponents.slice(0, 6).map(component => (
            <div key={`${record.id}-component-${component.id}`}>
              <strong>{component.label}</strong>
              <span>{formatCurrency(component.amount)} / {formatPercent(component.percent)} / {component.source}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Hammadde Dağılımı</h3>
        </div>
        <div className="daily-production-module-list">
          {record.rawMaterials.map(material => (
            <div key={`${record.id}-raw-${material.id}`}>
              <strong>{material.name}</strong>
              <span>{formatNumber(material.quantity, 1)} {material.unit} / {formatCurrency(material.totalCost)} / {formatPercent(material.percent)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Operasyonel Etki</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="İşçilik" value={formatCurrency(record.laborCost)} detail={`${record.lineCode} / ${record.lineName}`} />
          <DetailMetric label="Enerji" value={formatCurrency(record.energyCost)} detail={record.workCenter} />
          <DetailMetric label="Fire Etkisi" value={formatCurrency(record.wasteImpact)} detail={formatPercent(percent(record.wasteImpact, record.totalCost))} />
          <DetailMetric label="Sevkiyat Etkisi" value={formatCurrency(record.shipmentImpact)} detail={formatPercent(percent(record.shipmentImpact, record.totalCost))} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Satın Alma Geçmişi</h3>
        </div>
        <div className="daily-production-module-list">
          {record.purchaseHistory.length === 0 && (
            <div>
              <strong>Kayıt yok</strong>
              <span>Seçilen ürün için satın alma öneri geçmişi bulunamadı.</span>
            </div>
          )}
          {record.purchaseHistory.map(item => (
            <div key={`${record.id}-purchase-${item.id}`}>
              <strong>{item.label} / {item.supplierName}</strong>
              <span>{formatCurrency(item.unitCost)} birim fiyat / {formatCurrency(item.expectedSaving)} tasarruf / {formatDateTime(item.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>AI İyileştirme Önerileri</h3>
        </div>
        <div className="daily-production-module-list">
          {record.aiSuggestions.map((suggestion, index) => (
            <div key={`${record.id}-ai-${index}`}>
              <strong>Öneri {index + 1}</strong>
              <span>{suggestion}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function DetailMetric({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail: string
}){
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

const getRiskClass = (risk: CostRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning'
  if(risk === 'MEDIUM') return 'warning'
  return 'success'
}
