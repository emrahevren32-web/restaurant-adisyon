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
    id: 'production-planning-critical-stock',
    category: 'Production',
    title: 'Production Planning kritik stok uyarisi',
    description: 'Planlama read-modeli mevcut stok minimum seviyeye dustugunde oncelikli uretim onerir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Mevcut stok <= minimum stok veya oncelik CRITICAL'
  },
  {
    id: 'production-planning-quantity-increase',
    category: 'Production',
    title: 'Production Planning uretim miktari artisi',
    description: 'Talep ve forecast planlanan uretimi asarsa miktar revizyonu onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Talep acigi / planlanan uretim >= 15%'
  },
  {
    id: 'production-planning-waste-revision',
    category: 'Production',
    title: 'Production Planning fire kaynakli revizyon',
    description: 'Fire orani yuksek urunlerde plan miktari ve recete toleransi yeniden degerlendirilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Fire orani >= 7%'
  },
  {
    id: 'production-planning-branch-demand-gap',
    category: 'Production',
    title: 'Production Planning sube talep acigi',
    description: 'Sube veya musteri talebi mevcut plan ve stokla karsilanamiyorsa plan revizyonu gerekir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Sube + musteri talebi > planlanan uretim + mevcut stok'
  },
  {
    id: 'capacity-planning-line-overload',
    category: 'Production',
    title: 'Capacity Planning hat asiri yuk',
    description: 'Kapasite planinda hat veya makine kullanimi %100 uzerine cikarsa ek kapasite onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Doluluk >= 100% veya asiri yuk > 0 dk'
  },
  {
    id: 'capacity-planning-maintenance-impact',
    category: 'Production',
    title: 'Capacity Planning maintenance etkisi',
    description: 'Bakim sinyali kullanilabilir kapasiteyi dusuruyorsa operasyon ve bakim koordinasyonu onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Maintenance kapali makine veya hat mevcut'
  },
  {
    id: 'capacity-planning-third-shift-needed',
    category: 'Production',
    title: 'Capacity Planning ek vardiya onerisi',
    description: 'Toplam asiri yuk mevcut vardiyada kapanamiyorsa 3. vardiya manuel senaryosu onerilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Toplam asiri yuk > 0 dk'
  },
  {
    id: 'capacity-planning-low-utilization',
    category: 'Production',
    title: 'Capacity Planning dusuk kullanim',
    description: 'Hat iki veya daha fazla planda dusuk dolulukta calisiyorsa plan kaydirma firsati vardir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Doluluk < 45% ve yuk > 0'
  },
  {
    id: 'machine-scheduling-conflict',
    category: 'Production',
    title: 'Machine Scheduling zaman cakismasi',
    description: 'Makine uygunlugu veya gorev zaman penceresi cakistiginda manuel revizyon onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Satir conflict true veya gorev kullanilabilir zaman disinda'
  },
  {
    id: 'machine-scheduling-waiting',
    category: 'Production',
    title: 'Machine Scheduling yuksek bekleme',
    description: 'Makine kuyrugunda bekleme suresi arttiginda plan, vardiya veya makine sirasi tekrar degerlendirilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Toplam bekleme >= 180 dk'
  },
  {
    id: 'machine-scheduling-setup-heavy',
    category: 'Production',
    title: 'Machine Scheduling setup yuksek',
    description: 'Setup ve temizlik payi toplam uretim suresini belirgin artiriyorsa recete bloklama veya manuel siralama onerilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Setup + temizlik / toplam calisma >= 25%'
  },
  {
    id: 'machine-scheduling-idle-machine',
    category: 'Production',
    title: 'Machine Scheduling bos makine',
    description: 'Makine timeline boslugu yuksekse uygun islerin manuel olarak kaydirilmasi kapasite kullanimini artirabilir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Bos zaman / kullanilabilir zaman >= 25%'
  },
  {
    id: 'workforce-planning-shift-missing',
    category: 'Production',
    title: 'Workforce Planning vardiya eksigi',
    description: 'Vardiya bazli uretim yuku mevcut atanan personeli asarsa manuel personel takviyesi onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Missing employee count > 0'
  },
  {
    id: 'workforce-planning-line-operator-gap',
    category: 'Production',
    title: 'Workforce Planning hat operator eksigi',
    description: 'Hat veya work center gorevi icin aktif personel bulunamazsa operator sayisi yetersiz kabul edilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Atama satiri MISSING'
  },
  {
    id: 'workforce-planning-machine-operator-missing',
    category: 'Production',
    title: 'Workforce Planning makine vardiya kapsami',
    description: 'Makine gorev saatini kapsayan vardiya/personel bulunamazsa makine baslatma riski olusur.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Conflict reason vardiya kapsami'
  },
  {
    id: 'workforce-planning-employee-overlap',
    category: 'Production',
    title: 'Workforce Planning personel cakismasi',
    description: 'Ayni personele cakisan zaman araliginda gorev atanirsa manuel revizyon gerekir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Conflict reason cakisan gorev'
  },
  {
    id: 'bottleneck-analysis-line-over-95',
    category: 'Production',
    title: 'Bottleneck Analysis hat kapasitesi >95',
    description: 'Hat kapasitesi surekli %95 uzerinde gorunuyorsa uretim akisi kritik darbogaz riski tasir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Hat utilization >= 95%'
  },
  {
    id: 'bottleneck-analysis-machine-top',
    category: 'Production',
    title: 'Bottleneck Analysis en yogun makine',
    description: 'Makine risk skoru yuksekse bekleme, setup, bakim ve queue etkisi birlikte incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Makine risk skoru >= 75'
  },
  {
    id: 'bottleneck-analysis-setup-share',
    category: 'Production',
    title: 'Bottleneck Analysis setup payi',
    description: 'Setup ve temizlik payi uretim suresinin anlamli bolumunu aliyorsa proses sirasi revizyonu gerekebilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Setup + temizlik / calisma >= 18%'
  },
  {
    id: 'bottleneck-analysis-personnel-capacity-loss',
    category: 'Production',
    title: 'Bottleneck Analysis personel kapasite kaybi',
    description: 'Personel eksigi gunluk kapasiteyi dusuruyorsa vardiya ve gorev kapsami manuel olarak incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Tahmini kapasite kaybi >= 12%'
  },
  {
    id: 'bottleneck-analysis-maintenance-impact',
    category: 'Production',
    title: 'Bottleneck Analysis maintenance etkisi',
    description: 'Bakim penceresi yogun uretim saatine denk geldiginde darbogaz etkisi artabilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Maintenance minutes > 0 veya MAINTENANCE tipi bottleneck'
  },
  {
    id: 'continuous-improvement-setup-reduction',
    category: 'Production',
    title: 'Continuous Improvement setup azaltma',
    description: 'Setup ve temizlik sureleri belirgin kazanc firsati olusturuyorsa manuel iyilestirme onerisi uretilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Expected setup gain >= 12%'
  },
  {
    id: 'continuous-improvement-machine-utilization',
    category: 'Production',
    title: 'Continuous Improvement makine kullanim artisi',
    description: 'Makine bos sure, bekleme veya doluluk sapmasi fayda skoru uretirse kullanim artisi onerilir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Machine opportunity benefit score >= 60'
  },
  {
    id: 'continuous-improvement-shift-waiting',
    category: 'Production',
    title: 'Continuous Improvement vardiya bekleme azaltma',
    description: 'Vardiya veya personel dagilimi bekleme suresini artiriyorsa manuel dagilim incelemesi onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Personnel or shift waiting >= 60 dk'
  },
  {
    id: 'continuous-improvement-maintenance-capacity',
    category: 'Production',
    title: 'Continuous Improvement bakim kapasite etkisi',
    description: 'Bakim sureleri kapasite kazanci firsati olusturuyorsa bakim penceresi gozden gecirilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Maintenance minutes > 0'
  },
  {
    id: 'continuous-improvement-urgent-opportunity',
    category: 'Production',
    title: 'Continuous Improvement acil firsat',
    description: 'Fayda ve risk skoru acil seviyeye ciktiginda yonetim gorunurlugu gerekir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Opportunity priority URGENT'
  },
  {
    id: 'critical-alert-stock-purchase',
    category: 'Inventory',
    title: 'Critical Alert kritik stok satin alma',
    description: 'Critical Alert Engine kritik stok alarmi uretirse satin alma veya depo transferi manuel olarak onerilir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Critical alert category STOCK and level HIGH/CRITICAL'
  },
  {
    id: 'critical-alert-maintenance-line',
    category: 'Production',
    title: 'Critical Alert hat/bakim plani',
    description: 'Makine, kapasite veya bakim alarmi uretildiginde hat ve bakim plani manuel olarak gozden gecirilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Critical alert category MACHINE/MAINTENANCE/CAPACITY'
  },
  {
    id: 'critical-alert-quality-fail',
    category: 'Quality',
    title: 'Critical Alert kalite FAIL aksiyonu',
    description: 'Kalite, HACCP, lot veya mal kabul alarmi FAIL etkisi tasiyorsa kalite aksiyon listesine alinmalidir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Critical alert category QUALITY/HACCP/LOT/GOODS_RECEIPT'
  },
  {
    id: 'critical-alert-machine-stop-review',
    category: 'Production',
    title: 'Critical Alert makine uygunluk incelemesi',
    description: 'Kritik makine alarmi otomatik durdurma yapmadan manuel uretim uygunlugu incelemesi onerir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Critical machine alert risk score >= 85'
  },
  {
    id: 'critical-alert-generic-critical',
    category: 'Management',
    title: 'Critical Alert yonetim gorunurlugu',
    description: 'CRITICAL seviye alarm yonetim Decision Support listesinde manuel aksiyon olarak gorunur.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Critical alert level CRITICAL'
  },
  {
    id: 'forecasting-production-increase',
    category: 'Production',
    title: 'Forecasting uretim/talep artisi',
    description: 'Forecasting Engine talep veya uretim tahmininde anlamli artis gordugunde kapasite ve malzeme hazirligi onerir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Forecast type PRODUCTION/DEMAND and growth >= 10%'
  },
  {
    id: 'forecasting-stock-critical',
    category: 'Inventory',
    title: 'Forecasting kritik stok tahmini',
    description: 'Stok tahmini kritik seviyeye yaklasiyorsa satin alma veya depo transferi erkene alinmalidir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Forecast type STOCK and daysToCritical <= 3'
  },
  {
    id: 'forecasting-purchase-early',
    category: 'Purchasing',
    title: 'Forecasting satin alma erkene cekme',
    description: 'Satin alma hacmi veya kritik stok riski artiyorsa siparis takvimi manuel olarak erkene cekilebilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Forecast type PURCHASING and risk HIGH/CRITICAL'
  },
  {
    id: 'forecasting-shipment-surge',
    category: 'Shipment',
    title: 'Forecasting sevkiyat hacmi artisi',
    description: 'Sevkiyat hacmi trend veya mevsimsellik nedeniyle artiyorsa arac ve yukleme kapasitesi incelenmelidir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Forecast type SHIPMENT and growth >= 10% or seasonal'
  },
  {
    id: 'forecasting-quality-risk',
    category: 'Quality',
    title: 'Forecasting kalite riski',
    description: 'Kalite tahmini FAIL veya conditional sinyallerinde artisa isaret ederse kontrol sikligi onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Forecast type QUALITY and risk HIGH/CRITICAL'
  },
  {
    id: 'forecasting-critical-risk',
    category: 'Management',
    title: 'Forecasting kritik risk',
    description: 'CRITICAL seviye tahmin yonetim Decision Support listesine manuel aksiyon olarak tasinir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Forecast risk CRITICAL'
  },
  {
    id: 'recommendation-engine-urgent',
    category: 'Management',
    title: 'Recommendation Engine acil oneri',
    description: 'Recommendation Engine kritik risk, beklenen fayda ve confidence skoruna gore acil manuel aksiyon onerisi uretir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Recommendation risk CRITICAL or priority URGENT'
  },
  {
    id: 'recommendation-engine-critical-stock',
    category: 'Inventory',
    title: 'Recommendation Engine kritik stok onerisi',
    description: 'Stok, forecast ve kritik alarm sinyalleri ayni varligi isaret ediyorsa stok aksiyonu manuel olarak incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'URGENT',
    thresholdLabel: 'Recommendation type STOCK and risk HIGH/CRITICAL'
  },
  {
    id: 'recommendation-engine-maintenance',
    category: 'Production',
    title: 'Recommendation Engine bakim/makine onceligi',
    description: 'Makine, bakim, kapasite ve bottleneck sinyalleri bakim zamaninin manuel incelenmesini gerektirebilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Recommendation type MACHINE/MAINTENANCE'
  },
  {
    id: 'recommendation-engine-quality',
    category: 'Quality',
    title: 'Recommendation Engine kalite kontrol sikligi',
    description: 'Kalite, HACCP, form ve alert sinyalleri kontrol sikliginin manuel artirilmasini onerebilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Recommendation type QUALITY'
  },
  {
    id: 'recommendation-engine-shipment',
    category: 'Shipment',
    title: 'Recommendation Engine sevkiyat takvimi',
    description: 'Sevkiyat, planlama ve forecast sinyalleri arac, yukleme veya teslimat takviminin manuel incelenmesini gerektirebilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Recommendation type SHIPMENT'
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
    id: 'quality-form-product-fail-increase',
    category: 'Quality',
    title: 'Quality Forms urun FAIL orani artisi',
    description: 'Son kalite formlarinda ayni urunde FAIL orani artiyorsa kalite kok neden analizi gerekir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 30 gun FAIL orani onceki periyoda gore >= 10 puan'
  },
  {
    id: 'quality-form-supplier-problem',
    category: 'Quality',
    title: 'Quality Forms supplier kalite problemi',
    description: 'Ayni supplier son teslimatlarda tekrar eden kalite problemi olusturuyorsa satin alma ve kalite birlikte aksiyon almalidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 5 mal kabul kalite formunda >= 3 problem'
  },
  {
    id: 'quality-form-conditional-review',
    category: 'Quality',
    title: 'Quality Forms sartli onay takibi',
    description: 'Sartli onay verilen urunler serbest birakma oncesi HACCP, sample ve witness sample ile tekrar incelenmelidir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'CONDITIONAL veya Sartli Onay form sayisi > 0'
  },
  {
    id: 'operation-checklist-equipment-fail-increase',
    category: 'Production',
    title: 'Operations Checklists ekipman FAIL artisi',
    description: 'Ayni ekipman veya bakim checklistlerinde FAIL orani artiyorsa plansiz durus riski olusur.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 15 gun ekipman checklist FAIL orani >= 25%'
  },
  {
    id: 'operation-checklist-cleaning-incomplete',
    category: 'Quality',
    title: 'Operations Checklists temizlik tamamlanmama',
    description: 'Temizlik checklistleri duzenli tamamlanmiyorsa hijyen ve kalite riski artar.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 15 gun temizlik tamamlama < 80% veya madde tamamlama < 90%'
  },
  {
    id: 'operation-checklist-cold-room-deviation',
    category: 'Quality',
    title: 'Operations Checklists soguk oda sapmasi',
    description: 'Soguk oda checklistlerinde sicaklik veya depo duzeni sapmalari artiyorsa soguk zincir riski olusur.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 30 gun soguk oda WARNING/FAIL checklist sayisi >= 2'
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
    id: 'shipment-form-vehicle-return-increase',
    category: 'Shipment',
    title: 'Shipment Forms arac iade orani artisi',
    description: 'Ayni aracla yapilan sevkiyatlarda iade orani artiyorsa rota, yukleme ve teslim kontrolleri incelenmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 30 gun arac iade orani onceki periyoda gore >= 10 puan'
  },
  {
    id: 'shipment-form-cold-chain-deviation',
    category: 'Shipment',
    title: 'Shipment Forms soguk zincir sapmasi',
    description: 'Sicaklik loglarinda WARNING veya FAIL artarsa sogutucu sistem ve yukleme sureci kontrol edilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Son 30 gun sicaklik sapmasi >= 2'
  },
  {
    id: 'shipment-form-driver-delay',
    category: 'Shipment',
    title: 'Shipment Forms sofor teslim gecikmesi',
    description: 'Sofor bazli teslim sureleri genel ortalamanin uzerindeyse rota ve durak planlari revize edilmelidir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Sofor ortalama teslim suresi genel ortalama + 0.5 gun'
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
    id: 'cost-optimization-raw-material',
    category: 'Purchasing',
    title: 'Cost Optimization hammadde maliyeti artisi',
    description: 'Cost Optimization Engine hammadde, satin alma ve recete maliyetindeki artisi parasal tasarruf potansiyeline cevirir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'RAW_MATERIAL tasarruf potansiyeli > 0 veya risk HIGH/CRITICAL'
  },
  {
    id: 'cost-optimization-energy',
    category: 'Production',
    title: 'Cost Optimization enerji maliyeti',
    description: 'Hat, makine bos sure ve kapasite verileri enerji maliyeti ortalamanin uzerine ciktiginda manuel inceleme onerir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'ENERGY kalemi veya bos sure kaynakli MACHINE kalemi'
  },
  {
    id: 'cost-optimization-maintenance',
    category: 'Production',
    title: 'Cost Optimization bakim maliyeti',
    description: 'Bakim ve makine kaynakli maliyet sapmasi kritik seviyeye yaklastiginda bakim penceresi manuel olarak incelenir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'MAINTENANCE kalemi veya maintenance source module'
  },
  {
    id: 'cost-optimization-waste',
    category: 'Production',
    title: 'Cost Optimization fire tasarrufu',
    description: 'Fire, lot, kalite ve recipe cost verileri parasal tasarruf firsati urettiginde kok neden analizi onerilir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'WASTE tasarruf potansiyeli > 0'
  },
  {
    id: 'cost-optimization-supplier',
    category: 'Purchasing',
    title: 'Cost Optimization alternatif supplier',
    description: 'Purchase Orders, Goods Receipt ve supplier kalite maliyetleri alternatif tedarikci karar sinyaline donusturulur.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Supplier bagli cost optimization kalemi'
  },
  {
    id: 'purchase-recommendation-critical-stock',
    category: 'Purchasing',
    title: 'Purchase Recommendation kritik stok',
    description: 'Minimum stok altina inen veya hizla tukenecek hammadde icin satin alma aksiyonu onerilir.',
    baseRisk: 'CRITICAL',
    priority: 'URGENT',
    thresholdLabel: 'Current stock <= minimum stock'
  },
  {
    id: 'purchase-recommendation-stockout-soon',
    category: 'Purchasing',
    title: 'Purchase Recommendation yaklasan stok tukenmesi',
    description: 'Tuketim hizi ve forecast sinyali stok tukenmesini yaklastirdiginda satin alma tarihi one cekilmelidir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Estimated stockout <= 7 gun'
  },
  {
    id: 'purchase-recommendation-forecast-order',
    category: 'Purchasing',
    title: 'Purchase Recommendation forecast siparis',
    description: 'Forecasting ve Recommendation Engine sinyalleri satin alma ihtiyacina donusturulur.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Forecast risk >= HIGH'
  },
  {
    id: 'purchase-recommendation-bulk-buy',
    category: 'Purchasing',
    title: 'Purchase Recommendation toplu alim',
    description: 'Supplier MOQ ve stok ihtiyaci birlikte avantaj urettiginde toplu alim degerlendirilir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Recommended quantity >= MOQ'
  },
  {
    id: 'purchase-recommendation-alternative-supplier',
    category: 'Purchasing',
    title: 'Purchase Recommendation alternatif tedarikci',
    description: 'Alternatif tedarikci fiyat veya kalite avantaji varsa satin alma karsilastirmasi onerilir.',
    baseRisk: 'MEDIUM',
    priority: 'HIGH',
    thresholdLabel: 'Alternative supplier advantage >= 5%'
  },
  {
    id: 'purchase-recommendation-cost-advantage',
    category: 'Purchasing',
    title: 'Purchase Recommendation maliyet avantaji',
    description: 'Cost Optimization ve Recipe Cost sinyalleri satin alma tasarruf aksiyonuna donusturulur.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Expected saving > 0'
  },
  {
    id: 'purchase-recommendation-waste-replenishment',
    category: 'Purchasing',
    title: 'Purchase Recommendation fire yenileme',
    description: 'Fire ve mal kabul reddi kaynakli eksilen miktar satin alma takibine alinir.',
    baseRisk: 'HIGH',
    priority: 'HIGH',
    thresholdLabel: 'Waste/rejection quantity > 0'
  },
  {
    id: 'purchase-recommendation-seasonal-purchase',
    category: 'Purchasing',
    title: 'Purchase Recommendation sezonluk alim',
    description: 'Mevsimsel talep artisi satin alma hazirligi gerektirdiginde karar destegi uretir.',
    baseRisk: 'MEDIUM',
    priority: 'NORMAL',
    thresholdLabel: 'Seasonality score >= 25'
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
