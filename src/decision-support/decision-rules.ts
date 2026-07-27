import type { DecisionRule } from './decision-support.types'

export const DECISION_RULES: DecisionRule[] = [
  {
    id: 'production-delay-shift',
    category: 'Production',
    title: 'Geciken uretim icin ek vardiya oner',
    description: 'Teslim tarihi gecmis ve tamamlanmamis uretim emirleri ek kapasiteye ihtiyac duyabilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Delivery date bugunden eski ve status tamamlanmamis'
  },
  {
    id: 'production-buffer-stock',
    category: 'Production',
    title: 'Yuksek uretimli urun icin ara stok oner',
    description: 'Son 7 gunde ayni urun yogun uretiliyorsa ara stok planlamak sevkiyat baskisini azaltir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Son 7 gun urun toplam miktari kategori ortalamasinin uzerinde'
  },
  {
    id: 'production-capacity-line',
    category: 'Production',
    title: 'Kapasite ust limiti icin yeni hat oner',
    description: 'Uretim hatti %95 uzerinde calisiyorsa kapasite darboğazi riski vardir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Estimated utilization >= 95%'
  },
  {
    id: 'production-fire-root-cause',
    category: 'Production',
    title: 'Artan fire icin kok neden analizi oner',
    description: 'Fire orani uretim miktarina gore yuksekse proses, recete veya operator kaynakli nedenler incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Fire / uretim > 3%'
  },
  {
    id: 'inventory-critical-purchase',
    category: 'Inventory',
    title: 'Kritik stok icin satin alma oner',
    description: 'Mevcut stok minimum seviyenin altina dustugunde satin alma tetigi onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'currentQty <= minQty'
  },
  {
    id: 'inventory-expiry-priority',
    category: 'Inventory',
    title: 'SKT yaklasan lot icin oncelikli uretim veya sevkiyat oner',
    description: 'SKT yaklasan lotlar FEFO akisi ile onceliklendirilmelidir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Expiry date 14 gun icinde'
  },
  {
    id: 'inventory-warehouse-overflow',
    category: 'Inventory',
    title: 'Depo doluluk yuksekse alternatif depo oner',
    description: 'Depo doluluk orani %90 uzerindeyse alternatif depo veya sevkiyat hizlandirma onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Warehouse occupancy > 90%'
  },
  {
    id: 'inventory-slow-moving-campaign',
    category: 'Inventory',
    title: 'Yavas donen stok icin kampanya oner',
    description: 'Hareketi dusuk ama miktari yuksek stoklar icin tuketim veya kampanya aksiyonu onerilir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Son 30 gunde cikis yok ve mevcut stok min seviyenin uzerinde'
  },
  {
    id: 'quality-ccp-failure-risk',
    category: 'Quality',
    title: 'Tekrarlayan CCP FAIL icin risk uyarisi',
    description: 'Ayni CCP son 30 gunde cok FAIL verdiyse proses kontrolu sertlestirilmelidir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'CCP FAIL count >= 3'
  },
  {
    id: 'quality-haccp-meeting',
    category: 'Quality',
    title: 'HACCP basari orani dusuyorsa kalite toplantisi oner',
    description: 'PASS orani dusukse kalite, uretim ve depo ekipleri ortak aksiyon almalıdır.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'PASS rate < 90%'
  },
  {
    id: 'quality-recall-management-alert',
    category: 'Quality',
    title: 'Recall artisi icin yonetici uyarisi',
    description: 'Recall sayisi artarsa yonetim bilgilendirilmeli ve lot kaynak analizi yapilmalidir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Aktif recall count >= 2'
  },
  {
    id: 'quality-open-corrective-action',
    category: 'Quality',
    title: 'Uzun sure acik Corrective Action icin acil uyari',
    description: 'Acik corrective action kayitlari kapanmadan dogrulama guvenilirligi zayiflar.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'OPEN / IN_PROGRESS corrective action'
  },
  {
    id: 'purchasing-late-supplier',
    category: 'Purchasing',
    title: 'Teslim suresi uzayan tedarikci icin alternatif supplier oner',
    description: 'Gercek teslim suresi lead time uzerine cikarsa ikinci kaynak planlanmalidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Average delivery days > supplier lead time + 2'
  },
  {
    id: 'purchasing-rejection-risk',
    category: 'Purchasing',
    title: 'Yuksek red orani icin supplier risk olustur',
    description: 'Mal kabul red orani yuksek tedarikciler kalite ve satin alma tarafinda izlenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Rejected quantity / received quantity > 5%'
  },
  {
    id: 'purchasing-single-supplier',
    category: 'Purchasing',
    title: 'Tek tedarikci yogunlugu icin ikinci supplier oner',
    description: 'Alim hacminin buyuk kismi tek tedarikcideyse tedarik surekliligi riski olusur.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Supplier purchase volume share > 50%'
  },
  {
    id: 'shipment-low-utilization',
    category: 'Shipment',
    title: 'Dusuk arac dolulugu icin arac birlestir',
    description: 'Dusuk dolulukla cikan araclar maliyet ve karbon etkisini artirir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Vehicle utilization < 50%'
  },
  {
    id: 'shipment-delay-revision',
    category: 'Shipment',
    title: 'Geciken sevkiyat icin plan revizyonu oner',
    description: 'Plan tarihi gecmis aktif sevkiyatlar route ve arac planinda revizyon gerektirir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Active shipment plan date < today'
  },
  {
    id: 'shipment-return-quality-analysis',
    category: 'Shipment',
    title: 'Artan iade orani icin kalite analizi oner',
    description: 'Sevkiyat iade orani yuksekse paketleme, soguk zincir ve teslim kosullari incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Return count / completed shipment count > 15%'
  },
  {
    id: 'cost-engine-raw-material-increase',
    category: 'Production',
    title: 'Cost Engine hammadde maliyeti artisi',
    description: 'Hammadde veya satin alma fiyat farki urun maliyetini anlamli sekilde artiriyorsa tedarik ve recete alternatifi degerlendirilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Hammadde maliyet etkisi >= 18%'
  },
  {
    id: 'cost-engine-recipe-revision',
    category: 'Production',
    title: 'Cost Engine recete revizyonu oner',
    description: 'Recete fire orani veya fire maliyet payi yuksekse gramaj, proses ve toleranslar revize edilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Standart fire >= 5% veya fire maliyet payi >= 7%'
  },
  {
    id: 'cost-engine-fire-cost',
    category: 'Production',
    title: 'Cost Engine fire maliyet etkisi',
    description: 'Fire component toplam urun maliyetinin kritik bir payina ulastiginda kok neden analizi gerekir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Fire maliyet payi >= 7%'
  },
  {
    id: 'waste-product-increase',
    category: 'Production',
    title: 'Waste Management urun fire artisi',
    description: 'Son 30 gunde urun bazli fire artisi belirginse recete, lot ve proses kok nedeni incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 30 gun fire miktari onceki periyoda gore >= 20%'
  },
  {
    id: 'waste-blast-chilling-review',
    category: 'Quality',
    title: 'Soklama kaynakli fire icin proses kontrolu',
    description: 'Soklama veya sicaklik kaynakli fire varsa HACCP monitoring, bekleme suresi ve soguk zincir kontrolu birlikte incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Soklama veya sicaklik kaynakli fire miktari > 0'
  },
  {
    id: 'waste-warehouse-above-average',
    category: 'Inventory',
    title: 'Depo fire orani ortalamanin uzerinde',
    description: 'Depo bazli fire yogunlasmasi FEFO, SKT, ambalaj veya raf kontrol sorunu olusturabilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Depo fire miktari depo ortalamasinin uzerinde'
  },
  {
    id: 'management-critical-cluster',
    category: 'Management',
    title: 'Kritik risk kumesi icin yonetici aksiyon toplantisi oner',
    description: 'Birden fazla kritik risk ayni anda olustugunda koordineli yonetim aksiyonu gerekir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Critical suggestion count >= 3'
  }
]

export const getDecisionRule = (ruleId: string) => (
  DECISION_RULES.find(rule => rule.id === ruleId) || null
)
