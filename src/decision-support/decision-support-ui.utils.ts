export const DECISION_SOURCE_MODULE_LABELS: Record<string, string> = {
  AIAnalysis: 'Yapay Zeka Analizi',
  BottleneckAnalysis: 'Darboğaz Analizi',
  CapacityPlanning: 'Kapasite Planlama',
  ContinuousImprovement: 'Sürekli İyileştirme',
  CostOptimization: 'Maliyet Optimizasyonu',
  CriticalAlerts: 'Kritik Alarmlar',
  DecisionSupport: 'Karar Destek Merkezi',
  FireManagement: 'Fire Yönetimi',
  Forecasting: 'Tahminleme',
  GoodsReceipt: 'Mal Kabul',
  HACCP: 'HACCP',
  Inventory: 'Envanter',
  KPIDashboard: 'KPI Paneli',
  LotManagement: 'Lot Yönetimi',
  MachineScheduling: 'Makine Çizelgeleme',
  Maintenance: 'Bakım',
  OperationsChecklists: 'Operasyon Kontrolleri',
  ProductionPlanning: 'Üretim Planlama',
  Purchase: 'Satın Alma',
  PurchaseOrders: 'Satın Alma Siparişleri',
  PurchaseRecommendations: 'Satın Alma Önerileri',
  Quality: 'Kalite',
  QualityForms: 'Kalite Formları',
  ReadModel: 'Analiz Modeli',
  RecommendationEngine: 'Öneri Motoru',
  Shipment: 'Sevkiyat',
  ShipmentForms: 'Sevkiyat Formları',
  Stock: 'Stok',
  Warehouse: 'Depo',
  WorkforcePlanning: 'Vardiya Planlama'
}

export const formatDecisionCurrency = (value: number) => value.toLocaleString('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0
})

export const getDecisionSourceModuleLabel = (module: string) => (
  DECISION_SOURCE_MODULE_LABELS[module] || String(module || 'Analiz Modeli')
)

export const DECISION_ENTITY_TYPE_LABELS: Record<string, string> = {
  AIAnalysis: 'Yapay Zeka Analizi',
  BottleneckReport: 'Darboğaz Raporu',
  CapacityPlan: 'Kapasite Planı',
  CostEngine: 'Maliyet Motoru',
  CriticalControlPoint: 'Kritik Kontrol Noktası',
  ForecastPrediction: 'Tahmin Kaydı',
  GoodsReceipt: 'Mal Kabul',
  InventoryLot: 'Lot',
  MachineSchedule: 'Makine Çizelgesi',
  ProductionWorkOrder: 'Üretim İş Emri',
  PurchaseRecommendation: 'Satın Alma Önerisi',
  RecommendationItem: 'Öneri Kaydı',
  ShipmentPlan: 'Sevkiyat Planı',
  ShipmentVehicle: 'Sevkiyat Aracı',
  StockItem: 'Stok Kalemi',
  StockWasteRecord: 'Fire Kaydı',
  Supplier: 'Tedarikçi',
  Warehouse: 'Depo'
}

export const getDecisionEntityTypeLabel = (entityType: string) => (
  DECISION_ENTITY_TYPE_LABELS[entityType] || String(entityType || 'Analiz Kaydı')
)

export const getDecisionSeverityClass = (severity: string) => {
  if(severity === 'CRITICAL') return 'danger-pill'
  if(severity === 'HIGH') return 'warning-pill'
  if(severity === 'MEDIUM') return 'muted-pill'
  return 'success'
}

export const getDecisionInsightTypeClass = (type: string) => {
  if(type === 'RISK') return 'danger-pill'
  if(type === 'ANOMALY' || type === 'REPEATING_PROBLEM') return 'warning-pill'
  if(type === 'OPPORTUNITY') return 'success'
  return 'muted-pill'
}
