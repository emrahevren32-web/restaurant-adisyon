import type { AlertRule } from './critical-alert.types'

export const CRITICAL_ALERT_RULES: AlertRule[] = [
  {
    id: 'alert-rule-critical-stock',
    code: 'CRITICAL_STOCK',
    category: 'STOCK',
    level: 'HIGH',
    title: 'Kritik stok seviyesi',
    description: 'Mevcut stok minimum seviyeye esit veya altinda.',
    thresholdLabel: 'currentQty <= minQty',
    sourceModule: 'Stock',
    enabled: true
  },
  {
    id: 'alert-rule-negative-stock-risk',
    code: 'NEGATIVE_STOCK_RISK',
    category: 'STOCK',
    level: 'CRITICAL',
    title: 'Negatif stok riski',
    description: 'Stok miktari sifir veya altinda.',
    thresholdLabel: 'currentQty <= 0',
    sourceModule: 'Stock',
    enabled: true
  },
  {
    id: 'alert-rule-expiry-near',
    code: 'EXPIRY_NEAR',
    category: 'LOT',
    level: 'WARNING',
    title: 'SKT yaklasan urun',
    description: 'Lot son kullanma tarihi karar destek esigine yaklasti.',
    thresholdLabel: 'expiryDate <= 14 gun',
    sourceModule: 'LotManagement',
    enabled: true
  },
  {
    id: 'alert-rule-recall-risk',
    code: 'RECALL_RISK',
    category: 'LOT',
    level: 'CRITICAL',
    title: 'Lot geri cagirma riski',
    description: 'Aktif recall kaydi bulunan lotlar kritik izleme gerektirir.',
    thresholdLabel: 'recall status active',
    sourceModule: 'LotManagement',
    enabled: true
  },
  {
    id: 'alert-rule-haccp-fail',
    code: 'HACCP_FAIL',
    category: 'HACCP',
    level: 'CRITICAL',
    title: 'HACCP kritik limit asimi',
    description: 'HACCP izleme kaydında başarısız sonuç oluştu.',
    thresholdLabel: 'İzleme sonucu başarısız',
    sourceModule: 'HACCP',
    enabled: true
  },
  {
    id: 'alert-rule-quality-fail',
    code: 'QUALITY_FAIL_RATE',
    category: 'QUALITY',
    level: 'HIGH',
    title: 'Kalite başarısızlık oranı yükseliyor',
    description: 'Kalite Formları veya operasyon formlarında başarısız sonuç tespit edildi.',
    thresholdLabel: 'Başarısız sonuç sayısı > 0',
    sourceModule: 'QualityForms',
    enabled: true
  },
  {
    id: 'alert-rule-capacity-full',
    code: 'CAPACITY_FULL',
    category: 'CAPACITY',
    level: 'HIGH',
    title: 'Hat kapasitesi kritik',
    description: 'Capacity Planning hat dolulugunu kritik seviyede buldu.',
    thresholdLabel: 'utilization >= 100%',
    sourceModule: 'CapacityPlanning',
    enabled: true
  },
  {
    id: 'alert-rule-machine-conflict',
    code: 'MACHINE_CONFLICT',
    category: 'MACHINE',
    level: 'HIGH',
    title: 'Makine cizelge cakismasi',
    description: 'Machine Scheduling makine zaman veya kuyruk cakismasi tespit etti.',
    thresholdLabel: 'conflictCount > 0',
    sourceModule: 'MachineScheduling',
    enabled: true
  },
  {
    id: 'alert-rule-waiting-critical',
    code: 'WAITING_CRITICAL',
    category: 'PRODUCTION',
    level: 'HIGH',
    title: 'Bekleme suresi kritik',
    description: 'Makine, hat veya bottleneck bekleme suresi kritik esigi asti.',
    thresholdLabel: 'waitingMinutes >= 180',
    sourceModule: 'BottleneckAnalysis',
    enabled: true
  },
  {
    id: 'alert-rule-setup-critical',
    code: 'SETUP_CRITICAL',
    category: 'PRODUCTION',
    level: 'WARNING',
    title: 'Setup suresi kritik',
    description: 'Setup veya temizlik suresi uretim akisinda kritik kayip yaratiyor.',
    thresholdLabel: 'setupMinutes >= 60',
    sourceModule: 'MachineScheduling',
    enabled: true
  },
  {
    id: 'alert-rule-personnel-gap',
    code: 'PERSONNEL_GAP',
    category: 'PERSONNEL',
    level: 'HIGH',
    title: 'Personel eksikligi',
    description: 'Workforce Planning vardiya veya hat icin personel eksigi tespit etti.',
    thresholdLabel: 'missingPersonnel > 0',
    sourceModule: 'WorkforcePlanning',
    enabled: true
  },
  {
    id: 'alert-rule-shipment-delay',
    code: 'SHIPMENT_DELAY',
    category: 'SHIPMENT',
    level: 'HIGH',
    title: 'Sevkiyat gecikmesi',
    description: 'Aktif sevkiyat plani plan tarihini gecmis durumda.',
    thresholdLabel: 'planDate < today and status active',
    sourceModule: 'ShipmentForms',
    enabled: true
  },
  {
    id: 'alert-rule-goods-receipt-reject',
    code: 'GOODS_RECEIPT_REJECT',
    category: 'GOODS_RECEIPT',
    level: 'HIGH',
    title: 'Mal kabul red riski',
    description: 'Mal kabul surecinde red veya kismi kabul sinyali olustu.',
    thresholdLabel: 'status REJECTED or PARTIAL_ACCEPTED',
    sourceModule: 'GoodsReceipt',
    enabled: true
  },
  {
    id: 'alert-rule-maintenance-impact',
    code: 'MAINTENANCE_IMPACT',
    category: 'MAINTENANCE',
    level: 'HIGH',
    title: 'Bakim gecikmesi veya kapasite etkisi',
    description: 'Bakim kaynakli kapasite kaybi veya iyilestirme firsati tespit edildi.',
    thresholdLabel: 'maintenanceMinutes > 0',
    sourceModule: 'Maintenance',
    enabled: true
  }
]

export const listAlertRules = () => CRITICAL_ALERT_RULES.filter(rule => rule.enabled)

export const getAlertRule = (
  ruleId: string
) => CRITICAL_ALERT_RULES.find(rule => rule.id === ruleId) || null

export const AlertRuleService = {
  list: listAlertRules,
  get: getAlertRule
}
