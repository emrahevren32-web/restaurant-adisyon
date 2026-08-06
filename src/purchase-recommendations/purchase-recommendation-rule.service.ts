import type { PurchaseRecommendationRule } from './purchase-recommendation.types'

export const listPurchaseRecommendationRules = (): PurchaseRecommendationRule[] => [
  {
    id: 'purchase-recommendation-critical-stock',
    code: 'PR-REC-RULE-001',
    type: 'CRITICAL_STOCK',
    title: 'Kritik stok nedeniyle satın al',
    description: 'Minimum stok altına inen hammaddeler için manuel satın alma değerlendirmesi önerir.',
    sourceModule: 'Stock',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Mevcut stok <= minimum stok',
    enabled: true
  },
  {
    id: 'purchase-recommendation-stockout-soon',
    code: 'PR-REC-RULE-002',
    type: 'STOCKOUT_SOON',
    title: 'Yaklaşan stok tükenmesi',
    description: 'Tüketim hızına göre kısa sürede tükenecek stokları belirler.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Tahmini tükenme <= 7 gün',
    enabled: true
  },
  {
    id: 'purchase-recommendation-upcoming-production',
    code: 'PR-REC-RULE-003',
    type: 'UPCOMING_PRODUCTION',
    title: 'Yaklaşan üretim için satın al',
    description: 'Açık üretim emirleri ve reçete ihtiyaçlarını mevcut stokla karşılaştırır.',
    sourceModule: 'ProductionPlanning',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Üretim reçete ihtiyacı > mevcut stok',
    enabled: true
  },
  {
    id: 'purchase-recommendation-postpone-order',
    code: 'PR-REC-RULE-004',
    type: 'POSTPONE_ORDER',
    title: 'Siparişi ertele',
    description: 'Mevcut stok, açık talep ve SKT riski yeterli görünüyorsa satın alma zamanını ötelemeyi önerir.',
    sourceModule: 'PurchaseRequests',
    baseRisk: 'LOW',
    priority: 'LOW',
    thresholdLabel: 'Mevcut stok >= maksimum stok hedefi veya SKT riski yüksek',
    enabled: true
  },
  {
    id: 'purchase-recommendation-split-order',
    code: 'PR-REC-RULE-005',
    type: 'SPLIT_ORDER',
    title: 'Siparişi böl',
    description: 'Yüksek miktarlı açık talepleri teslim süresi ve tüketim riskine göre parçalara ayırmayı önerir.',
    sourceModule: 'PurchaseRequests',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Talep miktarı > güvenli stok hedefi',
    enabled: true
  },
  {
    id: 'purchase-recommendation-forecast-order',
    code: 'PR-REC-RULE-006',
    type: 'FORECAST_ORDER',
    title: 'Tahmine dayalı satın al',
    description: 'Tahminleme motoru talep ve stok sinyallerini satın alma ihtiyacına çevirir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Tahmin riski >= yüksek veya büyüme >= %10',
    enabled: true
  },
  {
    id: 'purchase-recommendation-bulk-buy',
    code: 'PR-REC-RULE-007',
    type: 'BULK_BUY',
    title: 'Toplu satın alma öner',
    description: 'Tedarikçi minimum miktarı ve maliyet avantajına göre toplu satın alma fırsatı üretir.',
    sourceModule: 'Suppliers',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Önerilen miktar >= tedarikçi minimum sipariş miktarı',
    enabled: true
  },
  {
    id: 'purchase-recommendation-alternative-supplier',
    code: 'PR-REC-RULE-008',
    type: 'ALTERNATIVE_SUPPLIER',
    title: 'Alternatif tedarikçi öner',
    description: 'Aktif alternatif tedarikçi maliyeti veya teslim süresi daha iyi görünüyorsa karşılaştırma önerir.',
    sourceModule: 'Suppliers',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Alternatif fiyat veya teslim avantajı var',
    enabled: true
  },
  {
    id: 'purchase-recommendation-lower-cost-supplier',
    code: 'PR-REC-RULE-009',
    type: 'LOWER_COST_SUPPLIER',
    title: 'Daha düşük maliyetli tedarikçi öner',
    description: 'Son alış fiyatı ve aktif tedarikçi fiyatlarını karşılaştırarak daha düşük maliyetli tedarikçiyi önerir.',
    sourceModule: 'Suppliers',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Alternatif tedarikçi fiyat avantajı >= %5',
    enabled: true
  },
  {
    id: 'purchase-recommendation-stock-sufficient',
    code: 'PR-REC-RULE-010',
    type: 'STOCK_SUFFICIENT',
    title: 'Mevcut stok yeterli',
    description: 'Stok, minimum stok ve kısa dönem üretim ihtiyacına göre satın alma yapılmamasını önerir.',
    sourceModule: 'Stock',
    baseRisk: 'LOW',
    priority: 'LOW',
    thresholdLabel: 'Mevcut stok >= kısa dönem ihtiyaç',
    enabled: true
  },
  {
    id: 'purchase-recommendation-wait-upcoming-delivery',
    code: 'PR-REC-RULE-011',
    type: 'WAIT_UPCOMING_DELIVERY',
    title: 'Yaklaşan teslimatı bekle',
    description: 'Bekleyen satın alma siparişinin teslim tarihi stok kapsaması içinde kalıyorsa yeni satın alma önermez.',
    sourceModule: 'PurchaseOrders',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Beklenen teslimat tarihi <= stok tükenme tarihi',
    enabled: true
  },
  {
    id: 'purchase-recommendation-expiry-risk-no-purchase',
    code: 'PR-REC-RULE-012',
    type: 'EXPIRY_RISK_NO_PURCHASE',
    title: 'SKT riski nedeniyle satın alma',
    description: 'Lot/SKT riski yüksekse yeni satın alma yerine tüketim ve rotasyon önerir.',
    sourceModule: 'InventoryLots',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'SKT yaklaşan veya geçmiş lot miktarı > güvenli eşik',
    enabled: true
  },
  {
    id: 'purchase-recommendation-cost-advantage',
    code: 'PR-REC-RULE-013',
    type: 'COST_ADVANTAGE',
    title: 'Maliyet avantajı',
    description: 'Maliyet Optimizasyon Motoru kaynaklı tasarruf sinyallerini satın alma önerisine çevirir.',
    sourceModule: 'CostOptimization',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Tasarruf potansiyeli > 0',
    enabled: true
  },
  {
    id: 'purchase-recommendation-waste-replenishment',
    code: 'PR-REC-RULE-014',
    type: 'WASTE_REPLENISHMENT',
    title: 'Fire kaynaklı yenileme',
    description: 'Fire ve kalite reddi kaynaklı eksilen miktarları satın alma takibine alır.',
    sourceModule: 'WasteManagement',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Fire miktarı > 0 ve aktif kayıt',
    enabled: true
  },
  {
    id: 'purchase-recommendation-seasonal-purchase',
    code: 'PR-REC-RULE-015',
    type: 'SEASONAL_PURCHASE',
    title: 'Sezonluk satın alma',
    description: 'Mevsimsel tahmin ve talep artışlarını tedarik hazırlığına çevirir.',
    sourceModule: 'Forecasting',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Mevsimsellik skoru >= 25',
    enabled: true
  }
]

export const PurchaseRecommendationRuleService = {
  list: listPurchaseRecommendationRules
}
