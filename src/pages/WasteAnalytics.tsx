import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { BarChartRow, KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  formatCurrency,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy,
  toFiniteNumber
} from '../kpi-reporting/kpi.utils'
import type { WastePredictionItem } from '../waste-predictions/waste-prediction.types'
import { WastePredictionService } from '../waste-predictions/waste-prediction.service'
import {
  WASTE_REASON_LABELS,
  WASTE_TYPE_LABELS,
  WasteService
} from '../waste-management/waste.service'
import type { WasteReason, WasteRecord, WasteType } from '../waste-management/waste.types'
import type { User } from '../types'

type WasteRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type WasteAnalyticsFilters = {
  startDate: string
  endDate: string
  branchId: string
  workCenter: string
  lineId: string
  machineId: string
  productId: string
  recipeId: string
  operatorId: string
  wasteTypeId: string
  wasteReasonId: string
  risk: WasteRisk | 'all'
  search: string
}

type OptionItem = {
  id: string
  name: string
}

type ProductOption = {
  id: string
  name: string
  unit: string
  stockItemId: string
  unitCost: number
}

type RecipeOption = {
  id: string
  code: string
  name: string
  productId: string
  productName: string
  firePercent: number
  ingredientSummary: string
}

type LineOption = {
  id: string
  code: string
  name: string
  workCenter: string
  branchId: string
  utilization: number
}

type MachineOption = {
  id: string
  code: string
  name: string
  lineId: string
  plannedMaintenanceMinutes: number
}

type OperatorOption = {
  id: string
  name: string
  title: string
  shift: string
  performanceScore: number
}

type ProductionOrderOption = {
  id: string
  no: string
  productName: string
  plannedQuantity: number
  branchId: string
  date: string
}

type WasteAnalyticsRecord = {
  id: string
  wasteNo: string
  date: string
  productId: string
  productName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  productionOrderId: string
  productionOrderNo: string
  branchId: string
  branchName: string
  workCenter: string
  lineId: string
  lineName: string
  machineId: string
  machineCode: string
  machineName: string
  operatorId: string
  operatorName: string
  operatorTitle: string
  shift: string
  lotId: string
  lotNo: string
  wasteReasonId: string
  wasteReasonLabel: string
  wasteTypeId: string
  wasteTypeLabel: string
  wasteQuantityKg: number
  unit: string
  wasteCost: number
  wasteRate: number
  risk: WasteRisk
  description: string
  plannedQuantity: number
  recipeFirePercent: number
  qualityResult: string
  haccpResult: string
  costImpact: string
  expectedSaving: number
  sourceSummary: string
  similarHistory: Array<{ label: string; value: string; detail: string }>
  improvementSuggestions: string[]
  createdAt: string
}

type WasteAnalyticsKpi = {
  id: string
  label: string
  value: string
  detail: string
  tone: KpiTone
}

type WasteAnalyticsModel = {
  sourceData: KpiSourceData
  records: WasteAnalyticsRecord[]
  predictions: WastePredictionItem[]
  suggestions: DecisionSuggestion[]
  generatedAt: string
}

const ALL_FILTER = 'all'
const RECORD_COUNT = 500
const PRODUCT_COUNT = 40
const LINE_COUNT = 20
const MACHINE_COUNT = 35
const OPERATOR_COUNT = 60
const PRODUCTION_ORDER_COUNT = 150
const RISK_LABELS: Record<WasteRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

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

const LINE_FALLBACKS = [
  'Sıcak Yemek Hattı 1',
  'Sıcak Yemek Hattı 2',
  'Et Hazırlık Hattı',
  'Tavuk Hazırlık Hattı',
  'Sebze Hazırlık Hattı',
  'Çorba Hattı',
  'TatlI ve Pasta Hattı',
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

const OPERATOR_NAMES = [
  'Ayşe Demir',
  'Mehmet Kaya',
  'Zeynep Şahin',
  'Murat Yıldız',
  'Elif Arslan',
  'Can Özkan',
  'Fatma Çelik',
  'Ali Koç',
  'Derya Aydın',
  'Hakan Polat',
  'Selin Aksoy',
  'Emre Güneş',
  'Buse Kaplan',
  'Okan Yalçın',
  'Seda Keskin',
  'Tuna Ergin',
  'İrem Doğan',
  'Ahmet Uslu',
  'Burcu Ateş',
  'Kerem Eren'
]

const BASE_WASTE_TYPES = [
  'Üretim Firesi',
  'Mal Kabul Firesi',
  'Şoklama Firesi',
  'Depo Firesi',
  'Paketleme Firesi',
  'Sevkiyat Firesi',
  'Kalite Reddi',
  'Numune Kullanımı',
  'Pişirme Gramaj Kaybı',
  'Hazırlık Ayıklama Firesi',
  'Soğutma Sonrası Fire',
  'Etiketleme Yeniden İşleme',
  'Reçete Sapması Firesi',
  'Makine Setup Firesi',
  'Lot Ayrım Firesi',
  'Alerjen Ayrım Firesi',
  'HACCP Kritik Limit Firesi',
  'Kırılma ve Dökülme',
  'Vakum Sızdırma Firesi',
  'Porsiyonlama Firesi',
  'Sos Dolum Firesi',
  'Fırınlama Kayıp Firesi',
  'Çorba Dolum Firesi',
  'Diyet Menü Ayrım Firesi',
  'Koli Hasarı',
  'Paletleme Firesi',
  'İade Ayrım Firesi',
  'Transfer Hasarı',
  'Tedarikçi Kaynaklı Fire',
  'Operasyonel Yeniden İşleme'
]

const BASE_WASTE_REASONS = [
  'Yanlış gramaj',
  'Yanlış reçete',
  'Operatör hatası',
  'Makine ayar sapması',
  'Şoklama sıcaklık sapması',
  'Ambalaj hasarı',
  'Etiket uyuşmazlığı',
  'SKT yaklaşımı',
  'Taşıma hasarı',
  'Kalite reddi',
  'Hammadde kalite farkı',
  'Pişirme süre sapması',
  'Soğutma bekleme süresi',
  'FEFO dışı tüketim',
  'Lot ayrım kararı',
  'Alerjen karantina',
  'Metal dedektör uyarısı',
  'pH limit sapması',
  'Nem oranı sapması',
  'Tuz oranı sapması',
  'Viskozite sapması',
  'Koli ezilmesi',
  'Palet devrilmesi',
  'Vakum kaçak testi',
  'Kapak sızdırma',
  'Dolum taşması',
  'Porsiyon toleransı',
  'Kesim kaybı',
  'Ayıklama fire kaybı',
  'Kemik ve sinir ayrımı',
  'Sebze kabuk kaybı',
  'Yıkama sonrası kayıp',
  'Tekrar ısıtma uygunsuzluğu',
  'Servis saati aşımı',
  'Gıda güvenliği blokajı',
  'HACCP kritik limit',
  'Tedarikçi sıcaklık sapması',
  'Mal kabul red kararı',
  'Depo sıcaklık dalgalanması',
  'Raf düzeni hatası',
  'Parti bölme kaybı',
  'Setup başlangıç kaybı',
  'Hat duruşu sonrası fire',
  'Bakım sonrası ilk ürün',
  'Personel vardiya değişimi',
  'Plan dışı bekleme',
  'Sevkiyat yükleme hasarı',
  'Müşteri iade ayrımı',
  'Şahit numune ayrımı',
  'Diğer kök neden'
]

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const clamp = (value: number, min = 0, max = 100) => (
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
)

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toDateKey = (value: unknown, fallback = new Date().toLocaleDateString('sv-SE')) => {
  if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleDateString('sv-SE')
  const text = normalizeText(value)
  if(/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const date = text ? new Date(text) : new Date(`${fallback}T00:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('sv-SE')
}

const parseSafeDate = (value: unknown, fallback = new Date().toISOString()) => {
  const text = normalizeText(value)
  const date = text
    ? new Date(text.includes('T') ? text : `${text}T00:00:00`)
    : new Date(fallback)
  if(!Number.isNaN(date.getTime())) return date

  const fallbackDate = new Date(fallback)
  return Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate
}

const addDays = (dateKey: string, days: number) => {
  const date = parseSafeDate(`${toDateKey(dateKey)}T00:00:00`)
  date.setDate(date.getDate() + Math.round(safeNumber(days)))
  return date.toLocaleDateString('sv-SE')
}

const createDateTime = (dateKey: string, hour: number, minute = 0) => {
  const date = parseSafeDate(`${toDateKey(dateKey)}T00:00:00`)
  date.setHours(clamp(Math.round(hour), 0, 23), clamp(Math.round(minute), 0, 59), 0, 0)
  return date.toISOString()
}

const formatDate = (value: string) => {
  if(!value) return '-'
  return parseSafeDate(value).toLocaleDateString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  return parseSafeDate(value).toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatQuantityKg = (value: number) => `${formatNumber(toFiniteNumber(value), 1)} kg`

const escapeHtml = (value: unknown) => normalizeText(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const getRiskClass = (risk: WasteRisk) => {
  if(risk === 'CRITICAL') return 'danger-pill'
  if(risk === 'HIGH') return 'warning-pill'
  if(risk === 'MEDIUM') return 'muted-pill'
  return 'success'
}

const createUniqueOptions = (
  options: OptionItem[]
) => Array.from(new Map(options.filter(option => option.id).map(option => [option.id, option])).values())
  .sort((first, second) => first.name.localeCompare(second.name, 'tr-TR'))

const createProducts = (sourceData: KpiSourceData): ProductOption[] => {
  const stockRows = sourceData.stockItems.map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit || 'kg',
    stockItemId: item.id,
    unitCost: item.averageCost || item.lastPurchasePrice || item.unitPurchasePrice || 95
  }))
  const productRows = sourceData.productRefs.map(product => {
    const stockItem = sourceData.stockItems.find(item => item.id === product.stockItemId)
    return {
      id: product.id || product.stockItemId || product.name,
      name: product.name,
      unit: product.unit || stockItem?.unit || 'kg',
      stockItemId: product.stockItemId || stockItem?.id || '',
      unitCost: stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || 95
    }
  })
  const fallbackRows = PRODUCT_FALLBACKS.map((name, index) => ({
    id: `waste_product_${index + 1}`,
    name,
    unit: index % 6 === 0 ? 'lt' : index % 5 === 0 ? 'adet' : 'kg',
    stockItemId: `waste_stock_${index + 1}`,
    unitCost: 38 + (index % 12) * 11
  }))
  const merged = [...productRows, ...stockRows, ...fallbackRows]
  const unique = createUniqueOptions(merged.map(item => ({ id: item.id, name: item.name })))

  return unique.slice(0, Math.max(PRODUCT_COUNT, unique.length)).map((option, index) => {
    const source = merged.find(item => item.id === option.id)
    return {
      id: option.id,
      name: option.name,
      unit: source?.unit || 'kg',
      stockItemId: source?.stockItemId || option.id,
      unitCost: safeNumber(source?.unitCost, 95 + (index % 9) * 8)
    }
  }).slice(0, PRODUCT_COUNT)
}

const createRecipes = (
  sourceData: KpiSourceData,
  products: ProductOption[]
): RecipeOption[] => {
  const sourceRecipes = sourceData.recipeRecords.map((recipe, index) => ({
    id: recipe.id,
    code: recipe.code || `RC-${String(index + 1).padStart(4, '0')}`,
    name: recipe.recipeName || recipe.productName || `Reçete ${index + 1}`,
    productId: products.find(product => normalizeSearchText(product.name) === normalizeSearchText(recipe.productName))?.id || products[index % products.length]?.id || '',
    productName: recipe.productName || products[index % products.length]?.name || '',
    firePercent: safeNumber(recipe.firePercent, 2 + (index % 6) * 0.4),
    ingredientSummary: recipe.ingredients.slice(0, 3).map(item => item.materialName).join(', ') || 'Standart üretim reçetesi'
  }))
  const fallbackRecipes = products.map((product, index) => ({
    id: `waste_recipe_${index + 1}`,
    code: `WR-${String(index + 1).padStart(4, '0')}`,
    name: `${product.name} Standart Reçetesi`,
    productId: product.id,
    productName: product.name,
    firePercent: roundKpi(1.6 + (index % 9) * 0.45),
    ingredientSummary: 'Ana hammadde, yardımcı malzeme, baharat karışımı'
  }))

  return createUniqueOptions([...sourceRecipes, ...fallbackRecipes].map(item => ({ id: item.id, name: item.name })))
    .map((option, index) => [...sourceRecipes, ...fallbackRecipes].find(item => item.id === option.id) || fallbackRecipes[index % fallbackRecipes.length])
}

const createLines = (sourceData: KpiSourceData): LineOption[] => Array.from({ length: LINE_COUNT }, (_, index) => {
  const sourceLine = sourceData.productionLines[index]
  const fallbackName = LINE_FALLBACKS[index % LINE_FALLBACKS.length]
  return {
    id: sourceLine?.id || `waste_line_${index + 1}`,
    code: sourceLine?.code || `HAT-${String(index + 1).padStart(2, '0')}`,
    name: sourceLine?.name || fallbackName,
    workCenter: sourceLine?.type || (index % 4 === 0 ? 'Sıcak Üretim' : index % 4 === 1 ? 'Soğuk Üretim' : index % 4 === 2 ? 'Paketleme' : 'Depo Hazırlık'),
    branchId: sourceData.branches[index % Math.max(sourceData.branches.length, 1)]?.id || '',
    utilization: safeNumber(sourceLine?.estimatedUtilization, 68 + (index % 24))
  }
})

const createMachines = (lines: LineOption[]): MachineOption[] => Array.from({ length: MACHINE_COUNT }, (_, index) => {
  const line = lines[index % lines.length]
  return {
    id: `waste_machine_${String(index + 1).padStart(3, '0')}`,
    code: `MK-${String(index + 1).padStart(3, '0')}`,
    name: index % 5 === 0 ? 'Pişirme Kazanı' : index % 5 === 1 ? 'Dolum Makinesi' : index % 5 === 2 ? 'Vakum Paketleme' : index % 5 === 3 ? 'Blast Chiller' : 'Porsiyonlama Makinesi',
    lineId: line.id,
    plannedMaintenanceMinutes: (index % 6) * 18
  }
})

const createOperators = (): OperatorOption[] => Array.from({ length: OPERATOR_COUNT }, (_, index) => ({
  id: `waste_operator_${String(index + 1).padStart(3, '0')}`,
  name: `${OPERATOR_NAMES[index % OPERATOR_NAMES.length]} ${Math.floor(index / OPERATOR_NAMES.length) + 1}`,
  title: index % 4 === 0 ? 'Hat Sorumlusu' : index % 4 === 1 ? 'Makine Operatörü' : index % 4 === 2 ? 'Paketleme Operatörü' : 'Kalite Destek Operatörü',
  shift: index % 3 === 0 ? 'Sabah' : index % 3 === 1 ? 'Akşam' : 'Gece',
  performanceScore: clamp(70 + (index % 25) + (index % 6) * 0.4, 52, 99)
}))

const createProductionOrders = (
  sourceData: KpiSourceData,
  products: ProductOption[]
): ProductionOrderOption[] => {
  const today = toDateKey(new Date())
  return Array.from({ length: PRODUCTION_ORDER_COUNT }, (_, index) => {
    const order = sourceData.productionOrders[index % Math.max(sourceData.productionOrders.length, 1)]
    const product = products[index % products.length]
    const orderLine = order?.lines?.[0]
    return {
      id: order?.id || `waste_order_${index + 1}`,
      no: order?.workOrderNo || `WO-WA-${String(index + 1).padStart(6, '0')}`,
      productName: orderLine?.productName || product.name,
      plannedQuantity: safeNumber(orderLine?.quantity, 520 + (index % 12) * 64),
      branchId: order?.branch || product.stockItemId || '',
      date: toDateKey(order?.createdAt || order?.deliveryDate || addDays(today, -(index % 45)))
    }
  })
}

const createWasteTypes = () => BASE_WASTE_TYPES.map((label, index) => ({
  id: `waste_type_${String(index + 1).padStart(2, '0')}`,
  label
}))

const createWasteReasons = () => BASE_WASTE_REASONS.map((label, index) => ({
  id: `waste_reason_${String(index + 1).padStart(2, '0')}`,
  label
}))

const mapWasteType = (
  record: WasteRecord | null,
  index: number,
  types: ReturnType<typeof createWasteTypes>
) => {
  if(record?.wasteType){
    return {
      id: `waste_type_source_${record.wasteType}`,
      label: WASTE_TYPE_LABELS[record.wasteType] || record.wasteType
    }
  }
  return types[index % types.length]
}

const mapWasteReason = (
  record: WasteRecord | null,
  index: number,
  reasons: ReturnType<typeof createWasteReasons>
) => {
  if(record?.wasteReason){
    return {
      id: `waste_reason_source_${record.wasteReason}`,
      label: WASTE_REASON_LABELS[record.wasteReason] || record.wasteReason
    }
  }
  return reasons[index % reasons.length]
}

const toKgEquivalent = (
  quantity: number,
  unit: string
) => {
  if(unit === 'gr') return roundKpi(quantity / 1000)
  if(unit === 'mg') return roundKpi(quantity / 1_000_000)
  if(unit === 'lt') return roundKpi(quantity)
  if(unit === 'ml') return roundKpi(quantity / 1000)
  if(unit === 'adet' || unit === 'paket' || unit === 'koli') return roundKpi(quantity * 0.35)
  return roundKpi(quantity)
}

const getBranch = (
  sourceData: KpiSourceData,
  branchId: string,
  index: number
) => {
  const branch = sourceData.branches.find(item => item.id === branchId)
    || sourceData.branches[index % Math.max(sourceData.branches.length, 1)]
  return {
    id: branch?.id || `branch_${index + 1}`,
    name: branch?.name || `Operasyon Şubesi ${index + 1}`
  }
}

const getRisk = (
  wasteRate: number,
  wasteCost: number,
  reasonLabel: string
): WasteRisk => {
  const reason = normalizeSearchText(reasonLabel)
  if(wasteRate >= 8 || wasteCost >= 32000 || reason.includes('haccp') || reason.includes('kalite reddi')) return 'CRITICAL'
  if(wasteRate >= 5 || wasteCost >= 18000 || reason.includes('sicaklik') || reason.includes('makine')) return 'HIGH'
  if(wasteRate >= 2.5 || wasteCost >= 8500) return 'MEDIUM'
  return 'LOW'
}

const createSimilarHistory = (
  record: WasteAnalyticsRecord,
  allRecords: WasteAnalyticsRecord[]
) => allRecords
  .filter(item => item.id !== record.id && (item.productId === record.productId || item.wasteReasonLabel === record.wasteReasonLabel))
  .slice(0, 4)
  .map(item => ({
    label: item.wasteNo,
    value: `${formatQuantityKg(item.wasteQuantityKg)} / ${formatCurrency(item.wasteCost)}`,
    detail: `${formatDate(item.date)} - ${item.wasteReasonLabel}`
  }))

const createImprovementSuggestions = (
  record: WasteAnalyticsRecord,
  predictions: WastePredictionItem[],
  suggestions: DecisionSuggestion[]
) => {
  const prediction = predictions.find(item => (
    item.productId === record.productId
    || item.stockItemId === record.productId
    || item.lotId === record.lotId
    || item.productionLineId === record.lineId
  ))
  const dss = suggestions.find(item => (
    item.ruleId.includes('waste')
    || item.ruleId.includes('fire')
    || item.relatedEntityId === record.lotId
    || item.relatedProductId === record.productId
  ))

  return [
    prediction?.action || '',
    dss?.recommendation.action || '',
    record.risk === 'CRITICAL' ? 'Fire kök neden analizi kalite, üretim ve bakım ekipleriyle aynı oturumda gözden geçirilmeli.' : '',
    record.wasteReasonLabel.includes('Makine') || record.wasteReasonLabel.includes('ayar') ? 'Makine setup parametreleri ve ilk ürün kontrol toleransları sıkılaştırılmalı.' : '',
    record.wasteReasonLabel.includes('SKT') || record.wasteReasonLabel.includes('FEFO') ? 'FEFO tüketim sırası ve lot rotasyonu günlük vardiya açılışında kontrol edilmeli.' : '',
    'Reçete toleransı, operatör vardiyası ve lot kalite sinyali birlikte izlenmeli.'
  ].filter(Boolean).slice(0, 5)
}

const createRecords = (
  sourceData: KpiSourceData,
  wasteRecords: WasteRecord[],
  predictions: WastePredictionItem[],
  suggestions: DecisionSuggestion[]
): WasteAnalyticsRecord[] => {
  const products = createProducts(sourceData)
  const recipes = createRecipes(sourceData, products)
  const lines = createLines(sourceData)
  const machines = createMachines(lines)
  const operators = createOperators()
  const productionOrders = createProductionOrders(sourceData, products)
  const wasteTypes = createWasteTypes()
  const wasteReasons = createWasteReasons()
  const today = toDateKey(new Date())

  const baseRecords = Array.from({ length: RECORD_COUNT }, (_, index) => {
    const sourceWaste = wasteRecords[index % Math.max(wasteRecords.length, 1)] || null
    const prediction = predictions[index % Math.max(predictions.length, 1)] || null
    const sourceProduct = products[index % products.length]
    const productId = sourceWaste?.productId || sourceWaste?.stockItemId || prediction?.productId || sourceProduct.id
    const productName = sourceWaste?.productName || sourceWaste?.stockItemName || prediction?.productName || sourceProduct.name
    const recipe = recipes.find(item => item.id === sourceWaste?.recipeId || item.productId === productId || normalizeSearchText(item.productName) === normalizeSearchText(productName))
      || recipes[index % recipes.length]
    const productionOrder = productionOrders.find(item => item.id === sourceWaste?.productionOrderId)
      || productionOrders[index % productionOrders.length]
    const line = lines.find(item => item.id === prediction?.productionLineId)
      || lines[index % lines.length]
    const machine = machines.find(item => item.lineId === line.id && item.id === prediction?.machineId)
      || machines.find(item => item.lineId === line.id)
      || machines[index % machines.length]
    const operator = operators[index % operators.length]
    const branch = getBranch(sourceData, sourceWaste?.branchId || prediction?.branchId || line.branchId, index)
    const date = toDateKey(sourceWaste?.date || prediction?.createdAt || productionOrder.date || addDays(today, -(index % 60)))
    const sourceUnit = sourceWaste?.unit || prediction?.unit || sourceProduct.unit || 'kg'
    const rawQuantity = safeNumber(sourceWaste?.quantity, prediction?.expectedWasteKg || (4 + (index % 16) * 2.8))
    const wasteQuantityKg = toKgEquivalent(rawQuantity, sourceUnit)
    const plannedQuantity = Math.max(safeNumber(productionOrder.plannedQuantity, 560 + (index % 10) * 58), wasteQuantityKg + 1)
    const unitCost = safeNumber(sourceWaste?.unitCost, prediction?.unitCost || sourceProduct.unitCost || 95)
    const calculatedCost = wasteQuantityKg * unitCost * (1 + (index % 5) * 0.035)
    const wasteCost = roundKpi(clamp(safeNumber(sourceWaste?.totalCost, calculatedCost), 0, 750000))
    const wasteRate = percent(wasteQuantityKg, plannedQuantity)
    const wasteType = mapWasteType(sourceWaste, index, wasteTypes)
    const wasteReason = mapWasteReason(sourceWaste, index, wasteReasons)
    const risk = getRisk(wasteRate, wasteCost, wasteReason.label)
    const qualityResult = risk === 'CRITICAL'
      ? 'Kalite incelemesi gerekli'
      : risk === 'HIGH'
        ? 'Şartlı kabul / tekrar kontrol'
        : sourceWaste?.qualityDecision || 'Uygun'
    const haccpResult = sourceWaste?.haccpReference
      || (wasteReason.label.includes('HACCP') || wasteReason.label.includes('sıcaklık') ? 'CCP izleme kontrolü gerekli' : 'Kritik sapma yok')
    const expectedSaving = roundKpi(wasteCost * (risk === 'CRITICAL' ? 0.42 : risk === 'HIGH' ? 0.32 : risk === 'MEDIUM' ? 0.2 : 0.1))

    return {
      id: `waste_analytics_${String(index + 1).padStart(4, '0')}`,
      wasteNo: sourceWaste?.wasteNo || `WA-${String(index + 1).padStart(6, '0')}`,
      date,
      productId,
      productName,
      recipeId: recipe?.id || '',
      recipeCode: recipe?.code || '',
      recipeName: recipe?.name || sourceWaste?.recipeName || '',
      productionOrderId: productionOrder.id,
      productionOrderNo: sourceWaste?.productionOrderNo || productionOrder.no,
      branchId: branch.id,
      branchName: branch.name,
      workCenter: line.workCenter,
      lineId: line.id,
      lineName: line.name,
      machineId: machine.id,
      machineCode: machine.code,
      machineName: machine.name,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorTitle: operator.title,
      shift: operator.shift,
      lotId: sourceWaste?.lotId || prediction?.lotId || `lot_waste_${String(index + 1).padStart(4, '0')}`,
      lotNo: sourceWaste?.lotNo || prediction?.lotNo || `LOT-WA-${String(index + 1).padStart(5, '0')}`,
      wasteReasonId: wasteReason.id,
      wasteReasonLabel: wasteReason.label,
      wasteTypeId: wasteType.id,
      wasteTypeLabel: wasteType.label,
      wasteQuantityKg,
      unit: 'kg',
      wasteCost,
      wasteRate,
      risk,
      description: sourceWaste?.description || `${wasteReason.label} nedeniyle ${line.name} üzerinde fire analizi üretildi.`,
      plannedQuantity,
      recipeFirePercent: recipe?.firePercent || prediction?.historicalWastePercent || 2.4,
      qualityResult,
      haccpResult,
      costImpact: wasteCost >= 18000 ? 'Maliyet etkisi yüksek' : wasteCost >= 8500 ? 'Maliyet etkisi izlenmeli' : 'Maliyet etkisi düşük',
      expectedSaving,
      sourceSummary: sourceWaste ? 'Waste Management read-model' : prediction ? 'Waste Prediction + Reporting seed' : 'Reporting seed read-model',
      similarHistory: [],
      improvementSuggestions: [],
      createdAt: createDateTime(date, 7 + (index % 10), (index * 7) % 60)
    } satisfies WasteAnalyticsRecord
  })

  return baseRecords.map(record => ({
    ...record,
    similarHistory: createSimilarHistory(record, baseRecords),
    improvementSuggestions: createImprovementSuggestions(record, predictions, suggestions)
  }))
}

const createModel = (): WasteAnalyticsModel => {
  const sourceData = loadKpiSourceData()
  const wasteRecords = WasteService.list(sourceData)
  const predictions = WastePredictionService.list(sourceData).flatMap(report => report.items)
  const suggestions = createDecisionSuggestions(sourceData).filter(suggestion => (
    suggestion.ruleId.includes('waste')
    || suggestion.ruleId.includes('fire')
  ))

  return {
    sourceData,
    records: createRecords(sourceData, wasteRecords, predictions, suggestions),
    predictions,
    suggestions,
    generatedAt: new Date().toISOString()
  }
}

const createDefaultFilters = (records: WasteAnalyticsRecord[] = []): WasteAnalyticsFilters => {
  const dates = records.map(record => record.date).filter(Boolean).sort()
  return {
    startDate: dates[0] || '',
    endDate: dates[dates.length - 1] || '',
    branchId: ALL_FILTER,
    workCenter: ALL_FILTER,
    lineId: ALL_FILTER,
    machineId: ALL_FILTER,
    productId: ALL_FILTER,
    recipeId: ALL_FILTER,
    operatorId: ALL_FILTER,
    wasteTypeId: ALL_FILTER,
    wasteReasonId: ALL_FILTER,
    risk: ALL_FILTER,
    search: ''
  }
}

const matchesFilter = (
  record: WasteAnalyticsRecord,
  filters: WasteAnalyticsFilters
) => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    record.wasteNo,
    record.productName,
    record.recipeName,
    record.productionOrderNo,
    record.lineName,
    record.machineCode,
    record.machineName,
    record.operatorName,
    record.lotNo,
    record.wasteReasonLabel,
    record.wasteTypeLabel,
    record.description
  ].join(' ')

  return (
    (!filters.startDate || record.date >= filters.startDate)
    && (!filters.endDate || record.date <= filters.endDate)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.workCenter === ALL_FILTER || record.workCenter === filters.workCenter)
    && (filters.lineId === ALL_FILTER || record.lineId === filters.lineId)
    && (filters.machineId === ALL_FILTER || record.machineId === filters.machineId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId)
    && (filters.recipeId === ALL_FILTER || record.recipeId === filters.recipeId)
    && (filters.operatorId === ALL_FILTER || record.operatorId === filters.operatorId)
    && (filters.wasteTypeId === ALL_FILTER || record.wasteTypeId === filters.wasteTypeId)
    && (filters.wasteReasonId === ALL_FILTER || record.wasteReasonId === filters.wasteReasonId)
    && (filters.risk === ALL_FILTER || record.risk === filters.risk)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
}

const createKpis = (records: WasteAnalyticsRecord[]): WasteAnalyticsKpi[] => {
  const totalWaste = sumBy(records, record => record.wasteQuantityKg)
  const plannedQuantity = sumBy(records, record => record.plannedQuantity)
  const wasteRate = percent(totalWaste, plannedQuantity)
  const totalCost = sumBy(records, record => record.wasteCost)
  const savingPotential = sumBy(records, record => record.expectedSaving)
  const topProduct = aggregateSumRows(records, record => record.productId, record => record.productName, record => record.wasteQuantityKg, formatQuantityKg, 'toplam fire')[0]
  const topLine = aggregateAverageRows(records, record => record.lineId, record => record.lineName, record => record.wasteRate, formatPercent, 'ortalama fire oranı')[0]

  return [
    {
      id: 'total-waste',
      label: 'Toplam Fire',
      value: formatQuantityKg(totalWaste),
      detail: `${formatNumber(records.length)} fire kaydı`,
      tone: totalWaste > 0 ? 'warning' : 'success'
    },
    {
      id: 'waste-rate',
      label: 'Fire Oranı (%)',
      value: formatPercent(wasteRate),
      detail: 'Fire / planlanan üretim',
      tone: wasteRate >= 5 ? 'danger' : wasteRate >= 2.5 ? 'warning' : 'success'
    },
    {
      id: 'total-waste-cost',
      label: 'Toplam Fire Maliyeti',
      value: formatCurrency(totalCost),
      detail: 'Miktar x birim maliyet etkisi',
      tone: totalCost >= 1_250_000 ? 'danger' : totalCost >= 650_000 ? 'warning' : 'success'
    },
    {
      id: 'top-waste-product',
      label: 'En Çok Fire Veren Ürün',
      value: topProduct?.label || '-',
      detail: topProduct?.formattedValue || 'Fire kaydı yok',
      tone: topProduct ? 'warning' : 'success'
    },
    {
      id: 'riskiest-line',
      label: 'En Riskli Üretim Hattı',
      value: topLine?.label || '-',
      detail: topLine?.formattedValue || 'Riskli hat yok',
      tone: topLine && topLine.value >= 5 ? 'danger' : topLine && topLine.value >= 2.5 ? 'warning' : 'success'
    },
    {
      id: 'saving-potential',
      label: 'Beklenen Tasarruf Potansiyeli',
      value: formatCurrency(savingPotential),
      detail: 'Kök neden aksiyonlarıyla azaltılabilir maliyet',
      tone: savingPotential > 0 ? 'success' : 'neutral'
    }
  ]
}

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string; formatter?: (value: number) => string; tone?: KpiTone }>,
  limit = 8
): BarChartRow[] => rows
  .filter(row => row.id && Number.isFinite(row.value))
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formatter ? row.formatter(row.value) : formatNumber(row.value, 1),
    detail: row.detail,
    tone: row.tone
  }))

const aggregateSumRows = (
  records: WasteAnalyticsRecord[],
  getKey: (record: WasteAnalyticsRecord) => string,
  getLabel: (record: WasteAnalyticsRecord) => string,
  getValue: (record: WasteAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number; cost: number }>>((acc, record) => {
    const key = getKey(record)
    if(!key) return acc
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: roundKpi((previous?.total || 0) + getValue(record)),
      count: (previous?.count || 0) + 1,
      cost: roundKpi((previous?.cost || 0) + record.wasteCost)
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    detail: `${formatNumber(row.count)} kayıt / ${formatCurrency(row.cost)} / ${detailLabel}`,
    formatter
  })))
}

const aggregateAverageRows = (
  records: WasteAnalyticsRecord[],
  getKey: (record: WasteAnalyticsRecord) => string,
  getLabel: (record: WasteAnalyticsRecord) => string,
  getValue: (record: WasteAnalyticsRecord) => number,
  formatter: (value: number) => string,
  detailLabel: string
) => {
  const map = records.reduce<Map<string, { label: string; total: number; count: number; cost: number }>>((acc, record) => {
    const key = getKey(record)
    if(!key) return acc
    const previous = acc.get(key)
    acc.set(key, {
      label: previous?.label || getLabel(record),
      total: (previous?.total || 0) + getValue(record),
      count: (previous?.count || 0) + 1,
      cost: roundKpi((previous?.cost || 0) + record.wasteCost)
    })
    return acc
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => {
    const average = row.count > 0 ? row.total / row.count : 0
    return {
      id,
      label: row.label,
      value: average,
      detail: `${formatNumber(row.count)} kayıt / ${formatCurrency(row.cost)} / ${detailLabel}`,
      formatter,
      tone: average >= 5 ? 'danger' as KpiTone : average >= 2.5 ? 'warning' as KpiTone : 'success' as KpiTone
    }
  }))
}

const createDailyRows = (records: WasteAnalyticsRecord[]) => {
  const map = records.reduce<Map<string, { quantity: number; cost: number; count: number }>>((acc, record) => {
    const previous = acc.get(record.date) || { quantity: 0, cost: 0, count: 0 }
    acc.set(record.date, {
      quantity: roundKpi(previous.quantity + record.wasteQuantityKg),
      cost: roundKpi(previous.cost + record.wasteCost),
      count: previous.count + 1
    })
    return acc
  }, new Map())

  return Array.from(map.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-12)
    .map(([date, row]) => ({
      id: `daily-waste-${date}`,
      label: formatDate(date),
      value: row.quantity,
      formattedValue: formatQuantityKg(row.quantity),
      detail: `${formatNumber(row.count)} kayıt / ${formatCurrency(row.cost)}`
    }))
}

const createParetoRows = (records: WasteAnalyticsRecord[]) => {
  const totals = aggregateSumRows(records, record => record.wasteReasonId, record => record.wasteReasonLabel, record => record.wasteCost, formatCurrency, 'maliyet')
  const totalCost = sumBy(totals, row => row.value)
  let cumulative = 0

  return totals.map(row => {
    cumulative = roundKpi(cumulative + row.value)
    return {
      ...row,
      detail: `${row.detail} / kümülatif ${formatPercent(percent(cumulative, totalCost))}`
    }
  })
}

const createChartGroups = (records: WasteAnalyticsRecord[]) => [
  {
    id: 'daily-waste-trend',
    title: 'Günlük Fire Trendi',
    rows: createDailyRows(records)
  },
  {
    id: 'waste-type-distribution',
    title: 'Fire Türü Dağılımı',
    rows: aggregateSumRows(records, record => record.wasteTypeId, record => record.wasteTypeLabel, record => record.wasteQuantityKg, formatQuantityKg, 'fire türü')
  },
  {
    id: 'product-waste',
    title: 'Ürün Bazlı Fire',
    rows: aggregateSumRows(records, record => record.productId, record => record.productName, record => record.wasteQuantityKg, formatQuantityKg, 'ürün fire')
  },
  {
    id: 'line-waste',
    title: 'Hat Bazlı Fire',
    rows: aggregateSumRows(records, record => record.lineId, record => record.lineName, record => record.wasteQuantityKg, formatQuantityKg, 'hat fire')
  },
  {
    id: 'machine-waste',
    title: 'Makine Bazlı Fire',
    rows: aggregateSumRows(records, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`, record => record.wasteQuantityKg, formatQuantityKg, 'makine fire')
  },
  {
    id: 'operator-waste',
    title: 'Operatör Bazlı Fire',
    rows: aggregateAverageRows(records, record => record.operatorId, record => record.operatorName, record => record.wasteRate, formatPercent, 'ortalama fire oranı')
  },
  {
    id: 'waste-cost-analysis',
    title: 'Fire Maliyet Analizi',
    rows: aggregateSumRows(records, record => record.wasteTypeId, record => record.wasteTypeLabel, record => record.wasteCost, formatCurrency, 'maliyet')
  },
  {
    id: 'waste-reason-pareto',
    title: 'Fire Sebepleri Pareto Grafiği',
    rows: createParetoRows(records)
  }
]

const createOptions = (
  records: WasteAnalyticsRecord[],
  getId: (record: WasteAnalyticsRecord) => string,
  getName: (record: WasteAnalyticsRecord) => string
) => createUniqueOptions(records.map(record => ({ id: getId(record), name: getName(record) })))

const mapRowsForOutput = (rows: WasteAnalyticsRecord[]) => rows.map(row => ({
  'Fire No': row.wasteNo,
  Tarih: formatDate(row.date),
  Ürün: row.productName,
  Reçete: `${row.recipeCode} / ${row.recipeName}`,
  'Üretim Emri': row.productionOrderNo,
  Hat: row.lineName,
  Makine: `${row.machineCode} / ${row.machineName}`,
  Operatör: row.operatorName,
  Lot: row.lotNo,
  'Fire Sebebi': row.wasteReasonLabel,
  'Fire Türü': row.wasteTypeLabel,
  'Fire Miktarı': row.wasteQuantityKg,
  'Fire Maliyeti': row.wasteCost,
  'Fire Oranı': row.wasteRate,
  Risk: RISK_LABELS[row.risk],
  Açıklama: row.description,
  'Beklenen Tasarruf': row.expectedSaving
}))

const exportFilteredRows = (rows: WasteAnalyticsRecord[]) => {
  ExcelIntegrationService.exportRows({
    moduleKey: 'waste',
    moduleLabel: 'Fire Analizi',
    sheetName: 'Fire Analizi',
    fileNamePrefix: 'fire-analizi-filtreli',
    fileName: `fire-analizi-filtreli-${toDateKey(new Date())}.xlsx`,
    rows: mapRowsForOutput(rows),
    userName: ExcelIntegrationService.defaultUserName
  })
}

const openPrintWindow = (
  rows: WasteAnalyticsRecord[],
  kpis: WasteAnalyticsKpi[],
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
      <td>${escapeHtml(row.wasteNo)}</td>
      <td>${escapeHtml(formatDate(row.date))}</td>
      <td>${escapeHtml(row.productName)}</td>
      <td>${escapeHtml(row.lineName)}</td>
      <td>${escapeHtml(row.machineCode)}</td>
      <td>${escapeHtml(row.operatorName)}</td>
      <td>${escapeHtml(row.wasteReasonLabel)}</td>
      <td>${escapeHtml(row.wasteTypeLabel)}</td>
      <td>${escapeHtml(formatQuantityKg(row.wasteQuantityKg))}</td>
      <td>${escapeHtml(formatCurrency(row.wasteCost))}</td>
      <td>${escapeHtml(formatPercent(row.wasteRate))}</td>
      <td>${escapeHtml(RISK_LABELS[row.risk])}</td>
    </tr>
  `).join('')

  printWindow.document.open()
  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Fire Analizi ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { margin:0; padding:${PRINT_SPACING_VALUES.space24}; color:${PRINT_THEME_COLORS.textDeep}; font-family:Arial, sans-serif; background:${PRINT_THEME_COLORS.background}; }
          h1 { margin:0; font-size:24px; }
          p { margin:${PRINT_SPACING_VALUES.space4} 0 ${PRINT_SPACING_VALUES.space16}; color:${PRINT_THEME_COLORS.textMutedStrong}; }
          .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:${PRINT_SPACING_VALUES.space8}; margin-bottom:${PRINT_SPACING_VALUES.space16}; }
          article { border:1px solid ${PRINT_THEME_COLORS.borderTable}; border-radius:8px; padding:${PRINT_SPACING_VALUES.space12}; page-break-inside:avoid; }
          article span, article small { display:block; color:${PRINT_THEME_COLORS.textMutedStrong}; font-size:12px; font-weight:700; }
          article strong { display:block; margin:${PRINT_SPACING_VALUES.space4} 0; font-size:20px; }
          table { width:100%; border-collapse:collapse; font-size:10.5px; }
          th, td { border:1px solid ${PRINT_THEME_COLORS.borderTable}; padding:${PRINT_SPACING_VALUES.space8}; text-align:left; vertical-align:top; }
          th { background:${PRINT_THEME_COLORS.pageBackground}; }
          @media print { body { padding:${PRINT_SPACING_VALUES.space16}; } }
        </style>
      </head>
      <body>
        <h1>Fire Analizi</h1>
        <p>Filtrelenmiş liste: ${escapeHtml(formatNumber(rows.length))} kayıt</p>
        <section class="grid">${kpiHtml}</section>
        <table>
          <thead>
            <tr><th>Fire No</th><th>Tarih</th><th>Ürün</th><th>Hat</th><th>Makine</th><th>Operatör</th><th>Sebep</th><th>Tür</th><th>Miktar</th><th>Maliyet</th><th>Oran</th><th>Risk</th></tr>
          </thead>
          <tbody>${tableRows || '<tr><td colspan="12">Kayıt bulunamadı.</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
}

export default function WasteAnalytics({ currentUser }: { currentUser: User }){
  const model = React.useMemo(() => createModel(), [])
  const [filters, setFilters] = React.useState<WasteAnalyticsFilters>(() => createDefaultFilters(model.records))
  const [selectedId, setSelectedId] = React.useState('')
  const filteredRecords = React.useMemo(
    () => model.records.filter(record => matchesFilter(record, filters)),
    [filters, model.records]
  )
  const selectedRecord = filteredRecords.find(record => record.id === selectedId) || filteredRecords[0]
  const kpis = React.useMemo(() => createKpis(filteredRecords), [filteredRecords])
  const chartGroups = React.useMemo(() => createChartGroups(filteredRecords), [filteredRecords])

  const branchOptions = React.useMemo(() => createOptions(model.records, record => record.branchId, record => record.branchName), [model.records])
  const workCenterOptions = React.useMemo(() => createOptions(model.records, record => record.workCenter, record => record.workCenter), [model.records])
  const lineOptions = React.useMemo(() => createOptions(model.records, record => record.lineId, record => record.lineName), [model.records])
  const machineOptions = React.useMemo(() => createOptions(model.records, record => record.machineId, record => `${record.machineCode} / ${record.machineName}`), [model.records])
  const productOptions = React.useMemo(() => createOptions(model.records, record => record.productId, record => record.productName), [model.records])
  const recipeOptions = React.useMemo(() => createOptions(model.records, record => record.recipeId, record => `${record.recipeCode} / ${record.recipeName}`), [model.records])
  const operatorOptions = React.useMemo(() => createOptions(model.records, record => record.operatorId, record => record.operatorName), [model.records])
  const wasteTypeOptions = React.useMemo(() => createOptions(model.records, record => record.wasteTypeId, record => record.wasteTypeLabel), [model.records])
  const wasteReasonOptions = React.useMemo(() => createOptions(model.records, record => record.wasteReasonId, record => record.wasteReasonLabel), [model.records])

  const updateFilter = <TKey extends keyof WasteAnalyticsFilters>(key: TKey, value: WasteAnalyticsFilters[TKey]) => {
    setFilters(previous => ({ ...previous, [key]: value }))
    setSelectedId('')
  }

  return (
    <div className="daily-production-analytics-page waste-analytics-page">
      <div className="page-header">
        <div>
          <span className="status-pill success">Salt Okunur</span>
          <h2>Fire Analizi</h2>
          <p className="muted">Fire kayıtları, üretim emirleri, reçeteler, hatlar, makineler, operatörler, lot, kalite, HACCP ve karar destek sinyallerini tek yönetici ekranında analiz eder.</p>
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
        <span>{formatNumber(model.records.length)} fire kaydı</span>
        <span>50 sebep / 30 tür / 150 üretim emri / 40 ürün / 20 hat / 35 makine / 60 operatör</span>
        <span>{formatNumber(model.predictions.length)} fire tahmini / {formatNumber(model.suggestions.length)} karar destek sinyali</span>
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
            <p className="muted">{formatNumber(filteredRecords.length)} kayıt listeleniyor. Bu ekran fire kaydı oluşturmaz, değiştirmez veya stok/muhasebe hareketi üretmez.</p>
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
          <FilterSelect label="Üretim Merkezi" value={filters.workCenter} options={workCenterOptions} onChange={value => updateFilter('workCenter', value)} />
          <FilterSelect label="Hat" value={filters.lineId} options={lineOptions} onChange={value => updateFilter('lineId', value)} />
          <FilterSelect label="Makine" value={filters.machineId} options={machineOptions} onChange={value => updateFilter('machineId', value)} />
          <FilterSelect label="Ürün" value={filters.productId} options={productOptions} onChange={value => updateFilter('productId', value)} />
          <FilterSelect label="Reçete" value={filters.recipeId} options={recipeOptions} onChange={value => updateFilter('recipeId', value)} />
          <FilterSelect label="Operatör" value={filters.operatorId} options={operatorOptions} onChange={value => updateFilter('operatorId', value)} />
          <FilterSelect label="Fire Türü" value={filters.wasteTypeId} options={wasteTypeOptions} onChange={value => updateFilter('wasteTypeId', value)} />
          <FilterSelect label="Fire Sebebi" value={filters.wasteReasonId} options={wasteReasonOptions} onChange={value => updateFilter('wasteReasonId', value)} />
          <label className="form-field">
            <span>Risk</span>
            <select value={filters.risk} onChange={event => updateFilter('risk', event.target.value as WasteAnalyticsFilters['risk'])}>
              <option value={ALL_FILTER}>Tüm Riskler</option>
              {Object.entries(RISK_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="form-field daily-production-search-field">
            <span>Arama</span>
            <input value={filters.search} onChange={event => updateFilter('search', event.target.value)} placeholder="Fire no, ürün, reçete, üretim emri, hat, makine, operatör, lot..." />
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
              <p className="muted">Fire no, ürün, reçete, üretim emri, hat, makine, operatör, lot, sebep, tür, miktar, maliyet ve risk.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table daily-production-table waste-analytics-table">
              <thead>
                <tr>
                  <th>Fire No</th>
                  <th>Tarih</th>
                  <th>Ürün</th>
                  <th>Reçete</th>
                  <th>Üretim Emri</th>
                  <th>Hat</th>
                  <th>Makine</th>
                  <th>Operatör</th>
                  <th>Lot</th>
                  <th>Fire Sebebi</th>
                  <th>Fire Türü</th>
                  <th>Fire Miktarı</th>
                  <th>Fire Maliyeti</th>
                  <th>Fire Oranı</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="empty-cell" colSpan={15}>Filtrelere uygun fire kaydı bulunamadı.</td>
                  </tr>
                )}
                {filteredRecords.map(record => (
                  <tr
                    aria-selected={selectedRecord?.id === record.id}
                    key={record.id}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <td data-label="Fire No"><strong>{record.wasteNo}</strong><span>{record.sourceSummary}</span></td>
                    <td data-label="Tarih">{formatDate(record.date)}</td>
                    <td data-label="Ürün"><strong>{record.productName}</strong><span>{record.branchName}</span></td>
                    <td data-label="Reçete">{record.recipeName}</td>
                    <td data-label="Üretim Emri">{record.productionOrderNo}</td>
                    <td data-label="Hat"><strong>{record.lineName}</strong><span>{record.workCenter}</span></td>
                    <td data-label="Makine"><strong>{record.machineCode}</strong><span>{record.machineName}</span></td>
                    <td data-label="Operatör">{record.operatorName}</td>
                    <td data-label="Lot">{record.lotNo}</td>
                    <td data-label="Fire Sebebi">{record.wasteReasonLabel}</td>
                    <td data-label="Fire Türü">{record.wasteTypeLabel}</td>
                    <td data-label="Fire Miktarı">{formatQuantityKg(record.wasteQuantityKg)}</td>
                    <td data-label="Fire Maliyeti">{formatCurrency(record.wasteCost)}</td>
                    <td data-label="Fire Oranı">{formatPercent(record.wasteRate)}</td>
                    <td data-label="Risk"><span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <WasteDetailPanel record={selectedRecord} />
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

function WasteDetailPanel({
  record
}: {
  record: WasteAnalyticsRecord | undefined
}){
  if(!record){
    return (
      <aside className="daily-production-side">
        <section className="card daily-production-detail-card">
          <div className="empty-state">Detay için bir fire kaydı seçin.</div>
        </section>
      </aside>
    )
  }

  return (
    <aside className="daily-production-side">
      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <div>
            <h3>Fire Özeti</h3>
            <p className="muted">{record.wasteNo} / {record.wasteTypeLabel}</p>
          </div>
          <span className={`status-pill ${getRiskClass(record.risk)}`}>{RISK_LABELS[record.risk]}</span>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Ürün" value={record.productName} detail={record.branchName} />
          <DetailMetric label="Fire Miktarı" value={formatQuantityKg(record.wasteQuantityKg)} detail={record.wasteReasonLabel} />
          <DetailMetric label="Fire Oranı" value={formatPercent(record.wasteRate)} detail={`Reçete toleransı ${formatPercent(record.recipeFirePercent)}`} />
          <DetailMetric label="Fire Maliyeti" value={formatCurrency(record.wasteCost)} detail={record.costImpact} />
          <DetailMetric label="Beklenen Tasarruf" value={formatCurrency(record.expectedSaving)} detail="İyileştirme potansiyeli" />
          <DetailMetric label="Tarih" value={formatDate(record.date)} detail={formatDateTime(record.createdAt)} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Üretim Bilgileri</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Üretim Emri" value={record.productionOrderNo} detail={`${formatQuantityKg(record.plannedQuantity)} planlandı`} />
          <DetailMetric label="Hat" value={record.lineName} detail={record.workCenter} />
          <DetailMetric label="Makine" value={`${record.machineCode} / ${record.machineName}`} detail={record.shift} />
          <DetailMetric label="Operatör" value={record.operatorName} detail={record.operatorTitle} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Reçete ve Lot</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Reçete" value={record.recipeName || '-'} detail={record.recipeCode || '-'} />
          <DetailMetric label="Standart Fire" value={formatPercent(record.recipeFirePercent)} detail="Reçete toleransı" />
          <DetailMetric label="Lot" value={record.lotNo} detail={record.lotId} />
          <DetailMetric label="Kaynak" value={record.sourceSummary} detail={record.description} />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Kalite ve HACCP</h3>
        </div>
        <div className="daily-production-module-list">
          <div>
            <strong>Kalite Sonucu</strong>
            <span>{record.qualityResult}</span>
          </div>
          <div>
            <strong>HACCP Sonucu</strong>
            <span>{record.haccpResult}</span>
          </div>
          <div>
            <strong>Risk Açıklaması</strong>
            <span>{record.description}</span>
          </div>
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Maliyet Etkisi</h3>
        </div>
        <div className="daily-production-detail-grid">
          <DetailMetric label="Toplam Etki" value={formatCurrency(record.wasteCost)} detail={record.costImpact} />
          <DetailMetric label="Tasarruf Potansiyeli" value={formatCurrency(record.expectedSaving)} detail="Fire azaltma aksiyonu" />
          <DetailMetric label="Birim Etki" value={formatCurrency(record.wasteCost / Math.max(record.wasteQuantityKg, 1))} detail="kg eşdeğer maliyet" />
          <DetailMetric label="Üretim Payı" value={formatPercent(record.wasteRate)} detail="Planlanan üretime oran" />
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>Benzer Fire Geçmişi</h3>
        </div>
        <div className="daily-production-module-list">
          {record.similarHistory.length === 0 && (
            <div>
              <strong>Benzer kayıt yok</strong>
              <span>Seçilen ürün veya sebep için yakın read-model geçmişi bulunmadı.</span>
            </div>
          )}
          {record.similarHistory.map(item => (
            <div key={`${record.id}-${item.label}`}>
              <strong>{item.label}</strong>
              <span>{item.value} / {item.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card daily-production-detail-card">
        <div className="section-header compact">
          <h3>İyileştirme Önerileri</h3>
        </div>
        <div className="daily-production-module-list">
          {record.improvementSuggestions.map((suggestion, index) => (
            <div key={`${record.id}-suggestion-${index}`}>
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
