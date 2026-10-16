# Menü ve ekran izin denetimi — 12 Ekim 2026

Fazla geniş izinler ve menü–ekran uyuşmazlıkları var. Uygulama kodu değiştirilmedi; çalışma ağacındaki mevcut değişiklikler korunarak denetlendi.

## Kapsam ve doğrulama

- Dondurulmamış modüllerde 52 rota taşıyan menü kaydı, 50 benzersiz izinli rota var. Kurulum tamam, entegrasyon yok ve bütün iş modülleri etkin varsayımıyla gerçek menü üreticisinde **49 ekran** çıkıyor. Aşağıdaki matris bu 49 ekranın tamamını kapsıyor.
- Modül etkinliği/lisans/sektör koşulları bir işletmede bu sayıyı azaltabilir. Denetim belirli bir işletmenin canlı oturumuna bağlanmadı.
- Menü kaydı kendi `requiredPermission` alanını belirtmezse `module.permissions[0]` devralınıyor (`src/navigation/workspace-navigation.registry.ts:96`). Rota koruması aynı eşlemeyi kullanıyor (`src/authorization/route-permission.ts:63`). İki katmanın aynı yanlış izni kullanması, eşlemenin doğru olduğu anlamına gelmiyor.
- Gerçek TypeScript menü/rota fonksiyonları çalıştırılarak tek izinli kullanıcı örnekleri doğrulandı. Sayfa bileşenleri stub ile değiştirilen rota hostunda Personel/Admin davranışları ayrıca kontrol edildi; bu kontrol tam tarayıcı testi değildir.
- Mevcut testler: `permission-enforcement.test.ts`, `module-route-health.test.ts`, `yetki-birlesimi.arch.test.ts`: **49/49 başarılı**. Bu testler bütün ekranların içerik/izin uygunluğunu ve Personel rolündeki render sonucunu sınamıyor.
- Veritabanı bulguları repository ve migration kaynaklarına dayanıyor. Canlı veritabanındaki uygulanmış politikalar ayrıca okunmadı.

## Bulgular

### 1. İzin listesinin kaybı bütün izin süzmesini kaldırıyor

`storage.ts:4245` içindeki `normalizeUser`, `permissions` ve `roleCode` alanlarını döndürmüyor. `loadUsers` ve `saveUsers` bu normalleştiriciyi kullanıyor. Kurulum tamamlandığında `App.tsx:716` kullanıcının oturum nesnesini `loadUsers()` kaydıyla değiştiriyor; yüklenmiş izinler React oturumundan düşebiliyor.

İzinler `undefined`/`null` olduğunda menüye `hasPermission` verilmiyor (`App.tsx:227`), rota kontrolü de `true` dönüyor (`route-permission.ts:116`). Normalleştiricinin gerçek gövdesiyle yapılan örnekte `permissions=['quality.read']` için `depo` erişimi önce `false`, normalleştirmeden sonra `true` çıktı. Bu yalnızca eski oturum ihtimali değildir; kurulum tamamlama akışında da oluşabiliyor.

Eski oturumlar `authentication.service.ts:48` üzerinden yerel kayıtla izinleri yeniden sorgulanmadan geri yükleniyor. Firması olmayan Admin için izin listesi eksikken `App.tsx:307` eski platform yöneticisi ölçütünü de devreye sokuyor. Yeni girişin izin sorgusu başarısızsa giriş reddediliyor; sorun bu geri yükleme/yenileme yollarında.

Öneri: oturumun yetki alanlarını korumak, yetkileri sunucudan yenilemek ve yüklenmemiş yetkiyi yüklenme durumu olarak ele almak; eksik listeyle korumalı ekranları açmamak.

### 2. Dört ekran üretim iznini yanlış devralıyor

Üretim modülü `production.read` ile başlıyor (`business-workspace.registry.ts:1799`). Aşağıdaki kayıtlarda açık bir ekran izni yok:

| Ekran | Şimdiki izin | Ekrana uygun alan izni | Menü kaydı |
| --- | --- | --- | --- |
| Reçeteler | `production.read` | `recipe.read` | registry:2042 |
| Müşteriler | `production.read` | `operations.read` | registry:2068 |
| Siparişler | `production.read` | `operations.read` | registry:2071 |
| Sevkiyatlar | `production.read` | `logistics.read` | registry:2076 |

Tek `production.read`, dört ekranı da menüye çıkarıyor ve rota izin kontrolünden geçiriyor. Tek `recipe.read`, `operations.read` veya `logistics.read` ilgili ekranları açmıyor. Müşteri ekranı müşteri fiyat defterini de içeriyor (`Musteriler.tsx:149,682`). Müşteri/sipariş alanının `operations.read` ile açılması önerisi, sayfaların `operations.write` yazma izniyle ve mevcut izin kataloğuyla tutarlıdır.

### 3. Stok/üretim okuma izni gerçek maliyet verisini de açıyor

| Ekran | Açan izin | `finance.read` olmadan gösterilen içerik | Kanıt |
| --- | --- | --- | --- |
| Stok Durumu | `stock.read` | Birim maliyet, stok değeri, son alış fiyatı | `Warehouse.tsx:695`, `:702`, `:713` |
| Fire ve Kayıplar | `stock.read` | Kayıpların parasal tutarı | `ZayiImha.tsx:321`, `:335`, `:362` |
| İş Emirleri | `production.read` | Toplam ve birim üretim maliyeti | `WorkOrders.tsx:220`, `:655`, `:663` |

Bu alanlar gerçek defterden hesaplanıyor. `stock.postgres.ts:382` stok hareketlerinde `select('*')` kullanıyor; `unit_cost` `:114` üzerinden modele taşınıyor. `stock-cost.ts:168` gerçek alış fiyatını seçiyor. Fire tarafı `write-off.repository.ts:115` ile aynı maliyet kolonunu okuyor; `write-off.service.ts:74` tutarı hesaplıyor. İş emirleri `work-order.service.ts:323` üzerinden aynı hareketlerden maliyet üretiyor.

`0006_yetkiler.sql:41` stok hareketlerine SELECT veriyor; `0003_stok_defteri.sql:150` okuma politikasında tenant koşulu var. Bu doğrudan okuma yollarında finans izni kontrolü bulunmadı. `0071` ve `0074` rapor RPC'lerinde finans kontrolü getiriyor; bunlar doğrudan stok hareketi okumayı korumuyor. `0073_beyan_yetkisi_ve_roller.sql:105,129` depo/personelin fiyat ve maliyet görmemesi gerektiğini belirtir.

Ana ekranı stok/üretim okuma izniyle açmak uygundur; parasal alanlar hem veri erişiminde hem görüntüleme/dışa aktarmada `finance.read` ile ayrılmalıdır. Menüde bütün stok ekranını finans iznine bağlamak bu ayrımı sağlamaz.

### 4. Şube okuma izni yönetim ve yetki değiştirmeyi açıyor

`business-workspace.registry.ts:2582,2609,2610` nedeniyle `branch.read`, Şube Yönetimi ve Şube Yetkilendirmeyi açıyor. Aynı `branches` rotasının kabul ettiği izinler `company.manage OR branch.read`.

`BranchManagement.tsx:188` ve `:132` kaydetme/yazma; `BranchPermissions.tsx:136` ve `:205` yetki oluşturma/değiştirme/silme yollarında `branch.manage` kontrolü yok. Bunlar yerel depolama işlemleridir.

Şube listesini `branch.read` ile açmak uygundur; oluşturma/düzenleme/silme `branch.manage` gerektirir. Yetkilendirme ekranının açılması da yönetim iznine bağlanmalıdır. Tek `branch.manage` bugün bu menü kayıtlarını açmıyor.

### 5. On yedi rapor/karar destek ekranı tek `dashboard.read` iznini kullanıyor

Raporlama ve Karar Destek modülleri `dashboard.read` ile başlıyor (`registry:1225,1369`); 17 ekranın hiçbiri ayrı ekran izni belirtmiyor (`registry:1347,1513`). Maliyet Analizi, Maliyet Optimizasyonu, Satın Alma Önerileri ve Personel Performansı dahil hepsi tek dashboard izniyle menü/rota kontrolünden geçiyor.

Maliyet/kârlılık: `CostAnalytics.tsx:992`; optimize maliyet: `CostOptimization.tsx:496`; tedarikçi fiyatı: `PurchaseRecommendations.tsx:743`; personel adı, sicil/devamsızlık/fazla mesai: `PersonnelPerformanceAnalytics.tsx:1240`. Parasal içerik ayrıca sevkiyat/fire/depo raporları ve karar destek metinlerinde bulunuyor.

**Bu 17 ekran eski yerel/demo modelinden besleniyor.** `kpi-source.service.ts:1,79` mock/storage kaynaklarını birleştiriyor; bazı karar raporları IndexedDB kullanıyor. Bu ekranlardan canlı Supabase finans verisi sızıntısı kanıtlanmış değildir. Ekran ve yerel içerik yetkisinin genişliği doğrulandı. Matriste alan izni önerileri ayrıca gösteriliyor; karma ekranlar ve dışa aktarımlar ilgili departman ve finans izinlerine göre süzülmelidir.

### 6. Personel ve eski lojistik ekranlarında okuma izni yazma işlemlerini de açıyor

Personel kartları, vardiya, puantaj, performans, prim ve disiplin `personnel.read` ile açılıyor; sayfalarda `personnel.manage` kontrolü olmadan kayıt ekleme/değiştirme/silme var. Örnekler: `EmployeeCards.tsx:120,214`, `ShiftManagement.tsx:168,272`, `AttendanceTracking.tsx:203,300`, `EmployeePerformanceTracking.tsx:128,210`, `EmployeeBonusSystem.tsx:178,272`, `EmployeeAuditRecords.tsx:132,203`.

Eski lojistik ekranları da `logistics.read` ile açılıp yerel kayıtları değiştiriyor: `ShipmentExecutions.tsx:262,267,272`; `ShipmentWaybills.tsx:460,760`; `DeliveryNotes.tsx` durum/oluşturma işlemleri. Bu ekranlar mock/localStorage modelidir. Okuma için ekranın açılması uygundur; yazma ayrı yönetim/yazma izniyle korunmalıdır.

### 7. Operasyon ekranlarının içindeki bazı yazma kapıları yanlış

| Ekran / işlem | Şimdiki yazma kapısı | Uygun izin | Etki |
| --- | --- | --- | --- |
| Reçete oluşturma/düzenleme | `production.write` (`ProductionRecipes.tsx:52`) | `recipe.write` | Reçete yazma izni olmayan üretim personeline eylem açılıyor. Reçete politikası tenant bazlı (`0021_receteler.sql:130,140`). |
| HACCP ölçüm/faaliyet | `quality.write OR stock.write` (`Haccp.tsx:77`) | `quality.write` | Stok yazma izni kalite yazma görevini de açıyor; HACCP tablolarında ayrıca departman kontrolü bulunmadı (`0024_haccp.sql:229,237`). |
| Gerçek sevkiyat oluşturma/düzenleme/sevk | `stock.write` (`Sevkiyatlar.tsx:91`) | `logistics.write` | Stok yazma, lojistik yazma görevini de açıyor; sevkiyat politikası tenant bazlı (`0023_sevkiyat.sql:96,104`). |
| Etiket/alerjen/besin beyanı kaydetme | `quality.write OR products.write` (`Etiketler.tsx:64`) | `quality.declaration` | Sunucu `0073:171,272` ile reddediyor. Veri yazma açığı kanıtı değildir; yetkisiz kullanıcıya başarısız olacak düğme açılıyor, yalnız beyan izni olan kullanıcı da düğmesiz kalabilir. |

### 8. Veri ve Yedekleme, denetim okuma izninin kapsamını aşıyor

Menü/rota `audit.read` kullanıyor (`registry:664`); `VeriYedegi.tsx:54` aynı izni dışa aktarma için kabul ediyor. `tenant-export.ts:56,189` bütün iş tablolarından `select('*')` ile JSON/Excel dosyası üretiyor. Denetim kaydı okumaya verilen izin, stok/müşteri/sipariş/satın alma/reçete dahil okunabilir iş verisini dışa aktarmaya da yetiyor.

Export RLS'i aşmıyor; ancak mevcut stok maliyeti SELECT yolu gibi geniş okuma politikalarının verdiği kolonları aynen taşıyor. Ayrı dışa aktarma izni ya da tanımlı yönetim izni gerekir. Ayrıca sayfanın kabul ettiği `settings.manage/company.manage`, rota kapısında tek başına yeterli değil; menü ve sayfa aynı kuralı kullanmıyor.

### 9. Üst menüdeki Şirket Profili şirket izni dışında düzenleniyor

`TopbarProfileMenu.ts:138` yalnız `role === 'Admin'` arıyor; `company-profile` izin kontrolünden muaf. `CompanyProfile.tsx:69,95` düzenlemeyi aynı rol koşuluyla açıyor. `company.manage` olmayan Admin yerel şirket profilini güncelleyebilir (`branch-directory.service.ts:125`). Şirket okuma/düzenleme izinleri ayrıca uygulanmalıdır.

### 10. İzinli personel menüyü görüyor ama ekranların çoğu açılmıyor

Menüden eski `adminOnly` kaldırılmış olsa da `BusinessWorkspaceRouteHost.tsx:290` hâlâ `if(!isAdmin) return null` içeriyor. Üretilen 49 ekrandan 48'i kendi doğru izni verilmiş **Personel** rolünde `null` dönüyor; yalnız Kontrol Paneli önce render ediliyor. Üst menüdeki Profilim de bu koşuldan sonra bulunduğundan personelde boş kalıyor.

Bu, yukarıdaki fazla geniş menü/rota eşlemeleri için önemli bir koşuldur: fazla geniş izin, Personel rolünde bugün her zaman görünür bir sayfa açılımına dönüşmüyor. Admin rolünde ve gerekli modül koşulları sağlandığında eşleme uygulanıyor. Eski Admin engeli kaldırılmadan önce yanlış ekran ve eylem izinleri de düzeltilmelidir; engelin varlığı doğru izin denetimi yerine geçmez.

İzlenebilirlikte ayrıca farklı kapı var: menü `quality.read` kullanırken `Traceability.tsx:94,210` `stock.read` arıyor. Yalnız kalite okuma izni olan kişi, genel rol engeli geçilse bile stok izni uyarısına düşer.

## 49 ekranın tamamı için matris

“Ana kapı uygun” yalnız ekranı açan alan izninin anlamını belirtir. Yazma, finans, eski Admin engeli ve veri kaynağı notları ayrıca değerlendirilmiştir. Önerilen izinler mevcut katalog anlamlarından çıkarılmıştır; özellikle karma karar ekranlarında tek bir departman izni yerine içerik bazlı süzme gerekir.

| # | Ekran / rota | Şimdiki açma izni | Değerlendirme / uygun kural |
| --- | --- | --- | --- |
| 1 | Kontrol Paneli `summary` | `dashboard.read` | Genel özet için ana kapı uygun. |
| 2 | Analiz `kpi-dashboard` | `finance.read` | Uygun; rapor RPC'leri de `0071/0074` ile finans izni arıyor. |
| 3 | Tedarikçiler `tedarikciler` | `purchase.read` | Ana kapı uygun; yazma `purchase.write` olmalı. |
| 4 | Satın Alma Siparişleri `satinalma` | `purchase.read` | Ana kapı uygun; yazma `purchase.write` olmalı. |
| 5 | Stok Durumu `depo` | `stock.read` | Ana kapı uygun; maliyet ayrıca `finance.read` gerektiriyor. |
| 6 | Stok Sayımları `sayimlar` | `stock.read` | Ana kapı uygun; sayım yazma stok yazma görevi. |
| 7 | Fire ve Kayıplar `zayi-imha` | `stock.read` | Ana kapı uygun; parasal tutar ayrıca `finance.read` gerektiriyor. |
| 8 | Reçeteler `receteler` | `production.read` | Yanlış alan: `recipe.read`; yazma da `recipe.write` olmalı. |
| 9 | İş Emirleri `uretim-emirleri` | `production.read` | Ana kapı uygun; maliyet ayrıca `finance.read` gerektiriyor. |
| 10 | Etiket ve Alerjen `etiketler` | `quality.read` | Ana kapı uygun; beyan eylemi `quality.declaration` ile uyuşmuyor. |
| 11 | Müşteriler `musteriler` | `production.read` | Yanlış alan: `operations.read`. |
| 12 | Siparişler `siparisler` | `production.read` | Yanlış alan: `operations.read`; onay ayrı `operations.approve`. |
| 13 | Sevkiyatlar `sevkiyatlar` | `production.read` | Yanlış alan: `logistics.read`; yazma `logistics.write` olmalı. |
| 14 | HACCP Kontrolleri `haccp-kayitlari` | `quality.read` | Ana kapı uygun; `stock.write` kalite eylemlerini de açıyor. |
| 15 | Ürün İzlenebilirliği `izlenebilirlik` | `quality.read` | Ana kapı uygun; sayfa ayrıca `stock.read` isteyerek çelişiyor. |
| 16 | İrsaliyeler `delivery-notes` | `logistics.read` | Ana kapı uygun; eski yerel modelde yazma/finans ayrımı yok. |
| 17 | Sevkiyat Operasyonu `shipment-executions` | `logistics.read` | Ana kapı uygun; yerel operasyon yazmaları `logistics.write` ile korunmuyor. |
| 18 | İrsaliye Süreci `shipment-waybills` | `logistics.read` | Ana kapı uygun; yerel yazmalar `logistics.write` ile korunmuyor. |
| 19 | Personel Kartları `employee-cards` | `personnel.read` | Ana kapı uygun; ekleme/düzenleme/silme `personnel.manage` aramıyor. |
| 20 | Vardiya `shift-management` | `personnel.read` | Ana kapı uygun; yazma `personnel.manage` aramıyor. |
| 21 | Puantaj `attendance-tracking` | `personnel.read` | Ana kapı uygun; yazma `personnel.manage` aramıyor. |
| 22 | Performans `employee-performance` | `personnel.read` | Ana kapı uygun; yazma `personnel.manage` aramıyor. |
| 23 | Prim `employee-bonus` | `personnel.read` | Ana kapı uygun; yazma `personnel.manage` aramıyor. |
| 24 | Disiplin `employee-audit` | `personnel.read` | Ana kapı uygun; yazma `personnel.manage` aramıyor. |
| 25 | Personel Raporları `employee-reports` | `personnel.read` | Personel raporu için ana kapı uygun; yerel veri. |
| 26 | Personel Takibi `staff` | `personnel.read` | Personel alanı uygun; gelir/indirim/ikram tutarları için ayrıca finans süzmesi yok (`StaffTracking.tsx:101`). |
| 27 | Şube Yönetimi `branches` | `branch.read`; rota ayrıca `company.manage` kabul ediyor | Görüntüleme uygun; yönetim eylemleri `branch.manage` aramıyor. |
| 28 | Şube Yetkilendirme `branch-permissions` | `branch.read` | Fazla geniş: yönetim izni (`branch.manage`) gerekli. |
| 29 | Günlük Üretim Analizi `daily-production-analytics` | `dashboard.read` | Üretim ayrıntısı için `production.read`; personel ayrıntısı ayrıca süzülmeli. Yerel/demo. |
| 30 | Haftalık Üretim Analizi `weekly-production-analytics` | `dashboard.read` | Üretim ayrıntısı için `production.read`. Yerel/demo. |
| 31 | Sevkiyat Analizi `shipment-analytics` | `dashboard.read` | `logistics.read`; maliyet blokları ayrıca `finance.read`. Yerel/demo. |
| 32 | Fire Analizi `waste-analytics` | `dashboard.read` | İlgili stok/üretim okuma; maliyet ayrıca `finance.read`. Yerel/demo. |
| 33 | Maliyet Analizi `cost-analytics` | `dashboard.read` | Fazla geniş: `finance.read` gerekli. Yerel/demo. |
| 34 | Depo Performansı `warehouse-performance-analytics` | `dashboard.read` | `stock.read`; fire maliyeti ayrıca `finance.read`. Yerel/demo. |
| 35 | Personel Performansı `personnel-performance-analytics` | `dashboard.read` | Fazla geniş: `personnel.read` gerekli. Yerel/demo. |
| 36 | Karar Destek Merkezi `decision-support` | `dashboard.read` | Karma içerik: departman ve finans izinleriyle süzülmeli. Yerel/demo. |
| 37 | Kritik Alarmlar `critical-alerts` | `dashboard.read` | İlgili departman alarm/ayrıntı izinleriyle süzülmeli. Yerel/demo. |
| 38 | Tahminleme `forecasting` | `dashboard.read` | İlgili departman/finans verisine göre süzülmeli. Yerel/demo. |
| 39 | Otomatik Öneriler `recommendation-engine` | `dashboard.read` | İlgili departman/finans önerilerine göre süzülmeli. Yerel/demo. |
| 40 | Yapay Zeka Analizi `ai-analysis` | `dashboard.read` | Finansal etki ve departman ayrıntıları izinlerine göre süzülmeli. Yerel/demo. |
| 41 | Maliyet Optimizasyonu `cost-optimization` | `dashboard.read` | Fazla geniş: `finance.read` gerekli. Yerel/demo. |
| 42 | Satın Alma Önerileri `purchase-recommendations` | `dashboard.read` | `purchase.read`; fiyat/maliyet ayrıca `finance.read`. Yerel/demo. |
| 43 | Üretim Planlama Önerileri `production-planning-recommendations` | `dashboard.read` | `production.read` uygun. Yerel/demo. |
| 44 | Fire Tahmini `waste-predictions` | `dashboard.read` | İlgili stok/üretim izni; maliyet ayrıca `finance.read`. Yerel/demo. |
| 45 | Sevkiyat Optimizasyonu `shipment-optimization` | `dashboard.read` | `logistics.read`; tasarruf/maliyet ayrıca `finance.read`. Yerel/demo. |
| 46 | Kullanıcılar `users` | `users.manage`; rota ayrıca `roles.manage` kabul ediyor | Sayfanın `canAssignRoles` kuralıyla tutarlı. |
| 47 | Şirket Ayarları `settings` | `settings.manage` | Ana kapı uygun; ayrıca eski Admin rolü kontrolü var. |
| 48 | Veri ve Yedekleme `veri-yedegi` | `audit.read` | Denetim okuma için fazla geniş dışa aktarma: ayrı export/yönetim kuralı gerekli. |
| 49 | Değişiklik Kaydı `islem-gecmisi` | `audit.read` | Ana kapı uygun. |

## Kayıtta bulunup bu menüde üretilmeyen üç kayıt

| Kayıt | İzin | Durum |
| --- | --- | --- |
| Roller → `users` | `roles.manage` | Çekirdek görünürlük/beyaz liste nedeniyle menüde yok. Aynı kullanıcı/rol ekranına işaret ediyor; rotadaki OR kuralı sayfayla tutarlı. |
| Şubeler → `branches` | `company.manage` | Çekirdek menüde yok. İş modülündeki Şube Yönetimi aynı rotaya `branch.read` ile giriyor. |
| Bildirimler → `notifications` | `company.read` | Çekirdek görünürlük/beyaz liste nedeniyle menüde yok. İzin haritasında kayıtlı; doğrudan rota için şirket okuma izni gerekiyor. |

Dondurulmuş modüller ve dondurulmuş alt menüler menüden ve rota kapsamından dışlanıyor. Bu yüzden etkin ekran matrisine eklenmedi.

## Üst profil menüsü ve platform menüsü

| Üst menü ekranı | Şimdiki kapı | Sonuç |
| --- | --- | --- |
| Profilim `my-profile` | Oturum; rota izinlerden muaf | Kendi profilini açmak uygun; Personel eski Admin koşulunda engelleniyor. |
| Şirket Profili `company-profile` | `role === 'Admin'`; rota izinlerden muaf | Şirket okuma/düzenleme izinleri eksik; bulgu 9. |

Platform kayıtlarında 25 rota, görünür menüde 19 giriş bulunuyor. Tüm platform kayıtları `adminOnly` ve `platformAdminOnly` taşıyor (`platform.registry.ts:346`). İzin listesi yüklüyken `isPlatformAdminUser` `platform.manage` arıyor (`App.tsx:305`); menü açma ve render da bunu uyguluyor (`App.tsx:795,971`). Bu koşul altında ek platform açılımı bulunmadı. Eksik izin listesindeki eski ölçüt bulgu 1'de ayrıca belirtilmiştir.

| Platform ekranı / rota | Ekranı açan kapı |
| --- | --- |
| Kontrol Paneli `evren360-dashboard` | `platform.manage` + Admin |
| Müşteri Listesi `evren360-customer-list` | `platform.manage` + Admin |
| Müşteri Detayı `evren360-customer-detail` | `platform.manage` + Admin |
| Onay Bekleyen İşletmeler `evren360-pending-applications` | `platform.manage` + Admin |
| Lisans Yönetimi `evren360-license-management` | `platform.manage` + Admin |
| Sistem Duyuruları `evren360-system-announcements` | `platform.manage` + Admin |
| Müşteri İstatistikleri `evren360-customer-statistics` | `platform.manage` + Admin |
| İşletme Yönetimi `evren360-company-management` | `platform.manage` + Admin |
| Tenant Yönetimi `tenant-management` | `platform.manage` + Admin |
| Fatura ve Tahsilat Takibi `evren360-billing-management` | `platform.manage` + Admin |
| Sektör Yönetimi `evren360-sector-management` | `platform.manage` + Admin |
| İşletme Başvuruları `business-registration-system` | `platform.manage` + Admin |
| Çalışma Alanı Kurulumu `company-setup-wizard` | `platform.manage` + Admin |
| Başvurular `evren360-applications` | `platform.manage` + Admin |
| Firmalar `evren360-companies` | `platform.manage` + Admin |
| Modüller `evren360-modules` | `platform.manage` + Admin |
| Modül Aktivasyon Sistemi `module-activation-system` | `platform.manage` + Admin |
| Lisanslar `evren360-licenses` | `platform.manage` + Admin |
| Paket Lisans Yönetimi `package-license-management` | `platform.manage` + Admin |
| Abonelikler `evren360-subscriptions` | `platform.manage` + Admin |
| Kullanıcı Abonelikleri `user-subscription-management` | `platform.manage` + Admin |
| Kullanıcılar `evren360-users` | `platform.manage` + Admin |
| Destek Talepleri `evren360-support` | `platform.manage` + Admin |
| İstatistikler `evren360-stats` | `platform.manage` + Admin |
| Sistem Ayarları `evren360-settings` | `platform.manage` + Admin |

## Düzeltme sırası önerisi

1. Oturum yenileme/normalleştirmede izin kaybını ve eksik izin listesinin erişimi genişletmesini kapatmak.
2. Dört yanlış departman eşlemesini, şube yetkilendirme ve dışa aktarma kapılarını düzeltmek.
3. Maliyet verisinin doğrudan okunabildiği yolları sunucuda finans iznine bağlamak; ekran ve dışa aktarmaları da aynı kurala geçirmek.
4. Reçete, HACCP, sevkiyat, etiket, personel ve eski lojistik sayfalarının eylem izinlerini doğru göreve bağlamak.
5. Bu eşleşmeler korunduktan sonra genel Admin engelini gerçek ekran izinleriyle değiştirmek; İzlenebilirlik/Profilim uyuşmazlıklarını çözmek.
6. Menüde ekranın görünmesinin yanında, izinli Personel için render ve izinsiz kullanıcı için veri/eylem sonuçlarını da sınamak.
