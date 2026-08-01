import type { RecommendationRule } from './recommendation-engine.types'

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: 'recommendation-rule-production-increase',
    code: 'PRODUCTION_INCREASE',
    type: 'PRODUCTION',
    title: 'Uretim miktarini artir',
    description: 'Tahminleme ve Karar Destek talep artışı sinyali verdiğinde üretim artışı önerir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Talep veya üretim artışı >= %10',
    enabled: true
  },
  {
    id: 'recommendation-rule-production-decrease',
    code: 'PRODUCTION_DECREASE',
    type: 'PRODUCTION',
    title: 'Uretim miktarini azalt',
    description: 'Stok fazlasi veya dusen talep sinyali varsa uretim miktari manuel azaltilabilir.',
    sourceModule: 'Forecasting',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Tahmin trendi düşüşte ve stok beklentisi pozitif',
    enabled: true
  },
  {
    id: 'recommendation-rule-purchase-order-needed',
    code: 'PURCHASE_ORDER_NEEDED',
    type: 'PURCHASING',
    title: 'Satin alma siparisi olusturulmali',
    description: 'Kritik stok, tahmin veya karar destek satın alma ihtiyacı ürettiğinde manuel satın alma önerir.',
    sourceModule: 'DecisionSupport',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Kritik stok veya yüksek satın alma tahmini',
    enabled: true
  },
  {
    id: 'recommendation-rule-critical-stock-replenish',
    code: 'CRITICAL_STOCK_REPLENISH',
    type: 'STOCK',
    title: 'Kritik stok yenilenmeli',
    description: 'Stok ve kritik alarm sinyalleri stok yenileme önerisi üretir.',
    sourceModule: 'CriticalAlerts',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Stok alarmı kritik veya kritik güne kalan süre <= 4',
    enabled: true
  },
  {
    id: 'recommendation-rule-machine-maintenance',
    code: 'MACHINE_MAINTENANCE',
    type: 'MAINTENANCE',
    title: 'Makine bakim plani one cekilmeli',
    description: 'Makine, darboğaz veya kritik alarm bakım etkisi ürettiğinde manuel bakım önerir.',
    sourceModule: 'CriticalAlerts',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Makine/bakım riski yüksek',
    enabled: true
  },
  {
    id: 'recommendation-rule-line-balance',
    code: 'LINE_BALANCE',
    type: 'MACHINE',
    title: 'Hat yuku dengelenmeli',
    description: 'Kapasite Planlama ve Darboğaz Analizi hat yükünü kritik bulduğunda dengeleme önerir.',
    sourceModule: 'CapacityPlanning',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Kullanım >= %95 veya aşırı yük > 0',
    enabled: true
  },
  {
    id: 'recommendation-rule-personnel-distribution',
    code: 'PERSONNEL_DISTRIBUTION',
    type: 'PERSONNEL',
    title: 'Personel dagilimi iyilestirilmeli',
    description: 'Vardiya Planlama eksik personel veya vardiya çakışması sinyali verdiğinde önerir.',
    sourceModule: 'WorkforcePlanning',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Eksik personel > 0 veya çakışma > 0',
    enabled: true
  },
  {
    id: 'recommendation-rule-shipment-reschedule',
    code: 'SHIPMENT_RESCHEDULE',
    type: 'SHIPMENT',
    title: 'Sevkiyat yeniden planlanmali',
    description: 'Sevkiyat Formları veya Tahminleme sevkiyat riskini artırdığında manuel planlama önerir.',
    sourceModule: 'ShipmentForms',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Sevkiyat riski yüksek veya hacim artışı var',
    enabled: true
  },
  {
    id: 'recommendation-rule-waste-analysis',
    code: 'WASTE_ANALYSIS',
    type: 'WASTE',
    title: 'Fire analizi yapilmali',
    description: 'Fire, kalite veya tahminleme fire artışı sinyali verdiğinde kök neden analizi önerir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Fire tahmini artıyor veya fire karar destek riski yüksek',
    enabled: true
  },
  {
    id: 'recommendation-rule-quality-control',
    code: 'QUALITY_CONTROL',
    type: 'QUALITY',
    title: 'Kalite kontrolu artirilmali',
    description: 'Kalite Formları, HACCP, kontrol listesi veya kritik alarm kalite riski ürettiğinde önerir.',
    sourceModule: 'QualityForms',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Kalite başarısız veya HACCP/kontrol listesi riski',
    enabled: true
  },
  {
    id: 'recommendation-rule-energy-idle',
    code: 'ENERGY_IDLE',
    type: 'ENERGY',
    title: 'Enerji ve bos sure incelenmeli',
    description: 'Makine bos sure ve kapasite kaybi enerji maliyeti etkisi yaratabilir.',
    sourceModule: 'MachineScheduling',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Boş süre >= 120 dakika',
    enabled: true
  }
]

export const listRecommendationRules = () => RECOMMENDATION_RULES.filter(rule => rule.enabled)

export const getRecommendationRule = (
  ruleId: string
) => RECOMMENDATION_RULES.find(rule => rule.id === ruleId) || null

export const RecommendationRuleService = {
  list: listRecommendationRules,
  get: getRecommendationRule
}
