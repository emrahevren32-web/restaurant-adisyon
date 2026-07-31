import type { PurchaseRecommendationRule } from './purchase-recommendation.types'

export const listPurchaseRecommendationRules = (): PurchaseRecommendationRule[] => [
  {
    id: 'purchase-recommendation-critical-stock',
    code: 'PR-REC-RULE-001',
    type: 'CRITICAL_STOCK',
    title: 'Kritik stok satin alma onerisi',
    description: 'Minimum stok altina inen hammaddeler icin satin alma aksiyonu onerir.',
    sourceModule: 'Stock',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Current stock <= minimum stock',
    enabled: true
  },
  {
    id: 'purchase-recommendation-stockout-soon',
    code: 'PR-REC-RULE-002',
    type: 'STOCKOUT_SOON',
    title: 'Yaklasan stok tukenmesi',
    description: 'Tuketim hizina gore kisa surede tukenecek stoklari belirler.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Estimated stockout <= 7 gun',
    enabled: true
  },
  {
    id: 'purchase-recommendation-forecast-order',
    code: 'PR-REC-RULE-003',
    type: 'FORECAST_ORDER',
    title: 'Tahmine dayali siparis',
    description: 'Forecasting Engine talep ve stok sinyallerini satin alma ihtiyacina cevirir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Forecast risk >= HIGH veya growth >= 10%',
    enabled: true
  },
  {
    id: 'purchase-recommendation-bulk-buy',
    code: 'PR-REC-RULE-004',
    type: 'BULK_BUY',
    title: 'Toplu alim firsati',
    description: 'Supplier minimum miktari ve maliyet avantajina gore toplu alim firsati uretir.',
    sourceModule: 'Suppliers',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Recommended quantity >= supplier MOQ',
    enabled: true
  },
  {
    id: 'purchase-recommendation-alternative-supplier',
    code: 'PR-REC-RULE-005',
    type: 'ALTERNATIVE_SUPPLIER',
    title: 'Alternatif tedarikci',
    description: 'Aktif alternatif tedarikci maliyeti daha dusukse karsilastirma onerir.',
    sourceModule: 'Suppliers',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Alternative price advantage >= 5%',
    enabled: true
  },
  {
    id: 'purchase-recommendation-cost-advantage',
    code: 'PR-REC-RULE-006',
    type: 'COST_ADVANTAGE',
    title: 'Maliyet avantaji',
    description: 'Cost Optimization Engine kaynakli tasarruf sinyallerini satin alma onerisine cevirir.',
    sourceModule: 'CostOptimization',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Saving potential > 0',
    enabled: true
  },
  {
    id: 'purchase-recommendation-waste-replenishment',
    code: 'PR-REC-RULE-007',
    type: 'WASTE_REPLENISHMENT',
    title: 'Fire kaynakli yenileme',
    description: 'Fire ve kalite reddi kaynakli eksilen miktarlari satin alma takibine alir.',
    sourceModule: 'WasteManagement',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Waste quantity > 0 ve aktif kayit',
    enabled: true
  },
  {
    id: 'purchase-recommendation-seasonal-purchase',
    code: 'PR-REC-RULE-008',
    type: 'SEASONAL_PURCHASE',
    title: 'Sezonluk satin alma',
    description: 'Mevsimsel forecast ve talep artislarini tedarik hazirligina cevirir.',
    sourceModule: 'Forecasting',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Seasonality score >= 25',
    enabled: true
  }
]

export const PurchaseRecommendationRuleService = {
  list: listPurchaseRecommendationRules
}
