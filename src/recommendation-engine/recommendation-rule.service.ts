import type { RecommendationRule } from './recommendation-engine.types'

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: 'recommendation-rule-production-increase',
    code: 'PRODUCTION_INCREASE',
    type: 'PRODUCTION',
    title: 'Uretim miktarini artir',
    description: 'Forecasting ve Decision Support talep artisi sinyali verdiginde uretim artisi onerir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Demand or production growth >= 10%',
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
    thresholdLabel: 'Forecast trend DOWN and stock expected positive',
    enabled: true
  },
  {
    id: 'recommendation-rule-purchase-order-needed',
    code: 'PURCHASE_ORDER_NEEDED',
    type: 'PURCHASING',
    title: 'Satin alma siparisi olusturulmali',
    description: 'Kritik stok, forecast veya DSS satin alma ihtiyaci urettiginde manuel satin alma onerir.',
    sourceModule: 'DecisionSupport',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Critical stock or purchasing forecast HIGH',
    enabled: true
  },
  {
    id: 'recommendation-rule-critical-stock-replenish',
    code: 'CRITICAL_STOCK_REPLENISH',
    type: 'STOCK',
    title: 'Kritik stok yenilenmeli',
    description: 'Stock ve Critical Alert sinyalleri stok yenileme onerisi uretir.',
    sourceModule: 'CriticalAlerts',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Stock alert CRITICAL or daysToCritical <= 4',
    enabled: true
  },
  {
    id: 'recommendation-rule-machine-maintenance',
    code: 'MACHINE_MAINTENANCE',
    type: 'MAINTENANCE',
    title: 'Makine bakim plani one cekilmeli',
    description: 'Makine, bottleneck veya critical alert bakim etkisi urettiginde manuel bakim onerir.',
    sourceModule: 'CriticalAlerts',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Machine/maintenance risk HIGH',
    enabled: true
  },
  {
    id: 'recommendation-rule-line-balance',
    code: 'LINE_BALANCE',
    type: 'MACHINE',
    title: 'Hat yuku dengelenmeli',
    description: 'Capacity Planning ve Bottleneck Analysis hat yukunu kritik buldugunda dengeleme onerir.',
    sourceModule: 'CapacityPlanning',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Utilization >= 95% or overload > 0',
    enabled: true
  },
  {
    id: 'recommendation-rule-personnel-distribution',
    code: 'PERSONNEL_DISTRIBUTION',
    type: 'PERSONNEL',
    title: 'Personel dagilimi iyilestirilmeli',
    description: 'Workforce Planning eksik personel veya vardiya cakismasi sinyali verdiginde onerir.',
    sourceModule: 'WorkforcePlanning',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Missing personnel > 0 or conflict > 0',
    enabled: true
  },
  {
    id: 'recommendation-rule-shipment-reschedule',
    code: 'SHIPMENT_RESCHEDULE',
    type: 'SHIPMENT',
    title: 'Sevkiyat yeniden planlanmali',
    description: 'Shipment Forms veya Forecasting sevkiyat riskini arttirdiginda manuel planlama onerir.',
    sourceModule: 'ShipmentForms',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Shipment risk HIGH or volume surge',
    enabled: true
  },
  {
    id: 'recommendation-rule-waste-analysis',
    code: 'WASTE_ANALYSIS',
    type: 'WASTE',
    title: 'Fire analizi yapilmali',
    description: 'Fire, kalite veya forecast fire artisi sinyali verdiginde kok neden analizi onerir.',
    sourceModule: 'Forecasting',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Waste forecast growth or waste DSS HIGH',
    enabled: true
  },
  {
    id: 'recommendation-rule-quality-control',
    code: 'QUALITY_CONTROL',
    type: 'QUALITY',
    title: 'Kalite kontrolu artirilmali',
    description: 'Quality Forms, HACCP, checklist veya critical alert kalite riski urettiginde onerir.',
    sourceModule: 'QualityForms',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Quality FAIL or HACCP/checklist risk',
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
    thresholdLabel: 'Idle minutes >= 120',
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
