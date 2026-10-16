# Yeni kiracı eksikleri — temiz tenant demo denetimi

Proje: `C:\Users\90544\Documents\restaurant-adisyon`  
Dal: `production-foundation`  
Kapsam: sıfırdan açılan tenant, güncel göçler `0000–0079` ve `src/`.  
Rapor dosyası: `docs/yeni-kiraci-eksikleri-2026-10-14.md`.

**Sonuç:** 0079 dahil göçler uygulanmışsa, normal başvuru onayı ve giriş hesabı açma yolunda HACCP ile aynı sınıftan başka eksik varsayılan tohum bulunmadı. `order_approval_step`, `tenant_license`, `haccp_plan` ve `haccp_ccp` için yeni kayıt yolları vardır. Aktif çekirdek ekranlarda boş iş verisinin yol açtığı bir çöküş doğrulanmadı. Dört ekran/ilk kullanım bulgusu kaldı: eski analizlerin mock veri göstermesi ve üç ön koşul/yönlendirme eksikliği. Bunlar **demoyu durdurmaz**, fakat temiz tenantın nasıl gösterileceğini etkiler.

**Kurulum ayrımı:** yalnız `tenant` tablosuna INSERT, tamamlanmış bir işletme değildir. Lisans **company INSERT** ile doğar; şirket/şube/kullanıcı olmadan iş ekranları çalışmaz. Bu koşulda demo **durur**; normal kurulum yolu bu kayıtları oluşturur. Aşağıda bu koşullu engel, yeni tenant seed açığıyla karıştırılmadan gösterilmiştir.

## Yöntem ve sınırlar

Kod, test, yapılandırma, göç, çalışan oturum ve gerçek localStorage değiştirilmedi. Yalnız bu rapor yazıldı. SQL çalıştırılmadı; canlı veritabanına veri yazılmadı.

- `db/migrations/*.sql` altındaki **87 SQL dosyası** tarandı: 80 numaralı göç ve 7 yardımcı/test/demo betiği.
- Yorum ve metin sabitleri ayrıştırılarak **159 gerçek INSERT** bulundu. CREATE TABLE/ALTER TABLE tanımlarıyla eşlenen **53 tenant_id taşıyan tabloya 78 INSERT** var. Bunların tamamı Ek A’da.
- Tenant tablolarına yazan 78 ifade: **8 genel varsayılan seed**, **4 ilk MIYOP kurulumu**, **5 normal işletme kurulum yazımı**, **3 tek demo işletmesi kurulumu**, **32 doğrulama/test yazımı**, **26 işlem/RPC/tetik yazımı**.
- Kalan 81 INSERT: 53 global katalog, 6 tenant oluşturma, 20 `_dogrulama` sınama kaydı, 2 `business_application_event` işlem kaydı. Tenant’a ait iş verisi seed’i olarak sayılmadılar.
- `src/pages/` altındaki **169 TSX ekranı** TypeScript AST ve kaynak/handler akışlarıyla tarandı. Aktif host ekranları önceliklendirildi; dondurulmuş ekranlar güncel demo rotalarıyla karıştırılmadı.
- Saf hesaplar ve mock kaynak zinciri bellekte değerlendirildi. Bu doğrulamada localStorage bir `Map` idi; Supabase istemcisi çağrısı yasak stub idi. Gerçek tarayıcı, gerçek DB ve uçtan uca demo provası çalıştırılmadı.
- Sonuç, güncel SQL kaynaklarının sıralı uygulanması ve tetiklerin etkin olması koşuluna dayanır. Canlı DB’de göçlerin uygulanmışlığı/etkinliği ayrıca okunmadı.

“Boş tenant”, normal kurulumun şirket/merkez şube/giriş kullanıcısı ve zorunlu varsayılanlarını oluşturduğu; stok kartı, stok hareketi, müşteri, tedarikçi, reçete, sipariş ve üretim işlemlerinin henüz olmadığı işletme olarak değerlendirildi.

## 1. Kiracı varsayılanlarının tamamı ve yeni kiracı yolları

Genel varsayılan seed yazımları dört tabloya yapılan sekiz INSERT’ten oluşuyor. Fonksiyonun daha sonraki göçte yeniden tanımlandığı yerlerde **son gövde** esas alındı.

| Veri | Migration anında mevcut tenantları dolduran kaynak | Sonradan doğan tenantta nasıl oluşur? | Demo etkisi |
| --- | --- | --- | --- |
| `haccp_plan` | `db/migrations/0024_haccp.sql:253`; `FROM tenant` `:256`. `tenant_id` tablosu `:41`. | `db/migrations/0079_yeni_kiraci_haccp.sql:141` tenant AFTER INSERT → wrapper `:128`, çağrı `:135` → helper `:38`, HP-01 INSERT `:53`. | **Demoyu durdurmaz — 0079 ile düzeltildi.** 0079 öncesinde yeni tenant plan almazdı; HACCP gösterimini durdururdu. |
| `haccp_ccp` | `db/migrations/0024_haccp.sql:259`; mevcut HP-01 planlarından `:267`, `:304`. `tenant_id` tablosu `:55`. | Aynı tenant tetiği `db/migrations/0079_yeni_kiraci_haccp.sql:141` → helper CCP INSERT `:70`; sekiz CCP değeri `:80` ve devamı, conflict koruması `:115`. | **Demoyu durdurmaz — 0079 ile düzeltildi.** Yeni planla birlikte sekiz kritik nokta doğar. |
| `order_approval_step` | Helper INSERT `db/migrations/0053_siparis_onay_zinciri.sql:338`; mevcut tenant loop `:358`, helper çağrısı `:359`. `tenant_id` tablosu `:53`. | Tenant AFTER INSERT `db/migrations/0053_siparis_onay_zinciri.sql:381` → wrapper `:368`, çağrı `:375` → güncel helper `db/migrations/0061_siparis_onay_izni.sql:64`, INSERT `:71`. DEPO/URETIM/SATIS `:74`, `:75`, `:76`. | **Demoyu durdurmaz.** Üç adım doğar; güncel satış onayı `operations.approve` kullanır. |
| `tenant_license` | İlk helper INSERT `db/migrations/0042_lisans.sql:178`; mevcut tenant loop `:212`, çağrı `:218`. Güncel INSERT `db/migrations/0043_lisans_defteri.sql:149`. `tenant_id` tablosu `db/migrations/0042_lisans.sql:65`. | **Company** AFTER INSERT `db/migrations/0042_lisans.sql:204` → wrapper `:195`, çağrı `:199` → güncel helper `db/migrations/0043_lisans_defteri.sql:115`, INSERT `:149`. | **Demoyu durdurmaz — normal şirketli kurulumda.** Yalnız tenant INSERT yeterli değildir; aşağıdaki koşullu engel geçerlidir. |

Kontrol örnekleri doğrulandı:

- `order_approval_step` yalnız migration-time loop’a bırakılmamış; yeni tenant tetiği vardır. 0061 hem eski adımları günceller (`db/migrations/0061_siparis_onay_izni.sql:57`) hem yeni tenant helper’ını değiştirir (`:64`). Yeni tenant eski `operations.write` değerine geri düşmez.
- `tenant_license` yeni şirketle doğar. 0043 açılışa lisans defteri olayı da ekler: `db/migrations/0043_lisans_defteri.sql:155` → `app.lisans_olayi_yaz` `:96` → `license_event` INSERT `:106`. `trial_days` güncel paketten okunur (`:147`); 90 günlük global paket güncellemesi `db/migrations/0045_deneme_suresi_3_ay.sql:14` üzerindedir. 0044 yalnız uzatma yolunu değiştirir (`db/migrations/0044_lisans_ucretli_ucretsiz.sql:25`); açılış tetiğini kaldırmaz.
- `haccp_plan/haccp_ccp` 0024’te yalnız mevcut tenant/planlardan dolduruluyordu. 0079 bu iki yazımı yeni tenant tetiğine bağlamıştır. 0079’un mevcut tenant doldurması `db/migrations/0079_yeni_kiraci_haccp.sql:151`, `:155`; tetik ve eksik plan/CCP kontrolü `:197`, `:209`, `:216` üzerindedir.

**Ek tarihsel sınır — demoyu durdurmaz (yeni tenant için):** 0079’un backfill’i HP-01 planı olmayan tenantları seçer (`db/migrations/0079_yeni_kiraci_haccp.sql:151`, `:152`). HP-01 planı olup CCP’si eksik eski tenantı bu loop ile tamamlamaz; son doğrulama bunu hata olarak yakalar (`:216`, `:224`). Bu, sıfırdan yeni tenantın doğum eksiği değildir.

## 2. Koşullu demo engeli: yalnız tenant satırı açmak

**Demoyu durdurur — yalnız tenant satırı oluşturulup normal işletme kurulumu atlanırsa.** Bu, mevcut demo tenantının hatalı kurulduğuna dair bir iddia değil, kaynakta açıkça doğrulanan kurulum sınırıdır.

`tenant_license` için eski tenant backfill’i şirketi olmayan tenantı da seçebilir (`db/migrations/0042_lisans.sql:212`, `:214`, `:218`). Sonradan doğan tenant ise lisansı ancak **company INSERT** ile alır (`:204`, `:205`, `:199`). Tenant INSERT tetiğiyle lisans açma yolu yoktur. Platform tenantının lisanssızlığı ayrıca bilinçlidir (`db/migrations/0043_lisans_defteri.sql:128`).

Normal başvuru onayı bu ön koşulları karşılar: tenant `db/migrations/0035_basvuru_onayi.sql:155`, şirket `:161`, merkez şube `:176`, varsayılan şube `:187`. Giriş hesabı açma ayrı adımdır; kullanıcı `db/migrations/0039_isletme_kullanicisi.sql:155`, rol `:166`, şube erişimi `:170` ile yazılır. Şube bulunmazsa hesap açma da açık hata üretir (`:144`, `:149`).

Yalnız tenant satırı olan kurulumda `src/warehouse/warehouse.context.ts:127`, `:128` şubesizliği kontrollü hata yapar; ilk elemana erişim bundan sonra gelir (`:131`). Depo bu hatayı yakalar (`src/pages/Warehouse.tsx:356`), HACCP de yakalar (`src/pages/Haccp.tsx:143`). React çökmesi yerine kurulum hatası görülür ve iş işlemi yapılamaz.

`demo_musteri_kur.sql` ise tenant `db/migrations/demo_musteri_kur.sql:60`, şirket `:68`, şube `:76`, varsayılan şube `:81`, owner kullanıcısı `:88` oluşturur. Yeni INSERT’lerde tenant/company tetikleri çalışır. Bu helper’ın tek demo müşteri kurması, genel tenant seed’i değildir.

## 3. Ekranlarda doğrulanan eksikler

| # | Bulgu ve ulaşılabilir yol | Dosya:satır kanıtı | Demo etkisi |
| --- | --- | --- | --- |
| 1 | **Yedi eski analiz ekranı boş Postgres tenantını temsil etmiyor.** Tarayıcı anahtarları yokken mock iş emirleri, üretim hatları, mamuller ve ilişkili kayıtlar doğuyor; önceki tarayıcı koleksiyonları da tenant değişimine göre süzülmüyor. Temiz tenantta gerçek stok/movement sıfır olsa da grafikler dolu görünebilir. | Aktif host rotaları `src/modules/BusinessWorkspaceRouteHost.tsx:438`, `:444`. Kaynak zinciri `src/kpi-reporting/kpi-source.service.ts:76`, `:81`, `:89`, `:100`. Mock doğurma: `src/production-work-orders/production-work-order.mock.ts:413`, `:419`; `src/production-lines/production-line.mock.ts:207`, `:213`; `src/final-products/final-product.mock.ts:141`, `:147`; `src/intermediate-products/intermediate-product.mock.ts:138`, `:144`. | **Demoyu durdurmaz.** Ekran çökmüyor; bu eski analizler gerçek temiz tenantın sonucu olarak sunulamaz. Genel `summary` ve `kpi-dashboard` için aşağıdaki gerçek boş durumlar ayrıdır. |
| 2 | **Etiket ekranı sıfır stok kartında sonuçsuz seçim çağrısı gösteriyor.** “Kalem yok” yanında “Soldan bir ürün seçin” var; seçilebilir ürün ve ilk kartı açma yönlendirmesi yok. | Gerçek `stock_item` okuması `src/production/label.repository.ts:150`; sayfa yükleme `src/pages/Etiketler.tsx:113`; boş satır `:282`, `:283`; sonuçsuz seçim mesajı `:312`. | **Demoyu durdurmaz.** Önce Depo’dan kart açılınca ilerler. Tohum eksikliği değil, ilk kullanım yönlendirme eksiği. |
| 3 | **Yeni reçete/iş emri formları sıfır stok kartıyla açılabiliyor.** Zorunlu mamul seçimi boş; gerekli başlangıç sırası yeterince açık değil. | Reçete açma `src/pages/ProductionRecipes.tsx:201`; required mamul select `:581`, boş katalog map’i `:583`. İş emri açma `src/pages/WorkOrders.tsx:347`; required mamul select `:843`, katalog map’i `:847`. | **Demoyu durdurmaz.** Önce stok kartı → reçete → iş emri akışı kullanılmalı. Kullanıcının oluşturacağı iş kayıtlarını otomatik seed’lemek gerekmiyor. |
| 4 | **Yeni sayım formu sıfır stok kartında açıklamasız boş tablo gösteriyor.** Seçilecek kart yok; sıfır seçime bağlı pasif düğme var. | `src/pages/Sayimlar.tsx:737` yalnız kalemleri map eder; `:770` sıfır seçimde gönderimi engeller. | **Demoyu durdurmaz.** Önce Depo’dan kart eklenince kullanılabilir. Ön koşulu anlatma eksiği. |

Son üç bulgunun mevcut çıkış yolu: `src/pages/Warehouse.tsx:452`, `:453` “Yeni Stok Kalemi”; kart formu `:565`, `:566`.

### Mock kaynak bulgusunun bellek doğrulaması

Bir yeni kullanıcı/firma/merkez şube ve sıfır iş verisi içeren **yalnız bellek** ortamında `loadKpiSourceData()` çalıştırıldı. Gerçek DB bağlantısı yasaktı; bütün mock localStorage yazımları bellek Map’ine gitti.

| Koleksiyon | Sonuç |
| --- | ---: |
| Stok kartı / stok hareketi | 0 / 0 |
| Yerel reçete | 58 |
| Mock üretim emri / hat | 10 / 5 |
| Mock HACCP kaydı | 3 |
| Mock lot / kalite numunesi | 20 / 20 |

Bu veriler yeni tenantın Supabase tablolarında oluşmadı; eski ekranların tarayıcı veri kaynağında oluştu. `src/recipe-management/recipe-management.mock.ts:14` ortak `ra_recipes` anahtarını kullanır; yükleme `:818`, seed birleştirme `:831` ve `:785`. `ra_recipes='[]'` verilse bile **58 reçete** döndü. Tedarikçi mock’u da mevcut koleksiyona seed birleştirir (`src/supplier-management/supplier-management.mock.ts:380`, `:398`, `:347`).

Yedi ekran: Günlük/Haftalık Üretim Analizi, Sevkiyat Analizi, Fire Analizi, Maliyet Analizi, Depo Performansı, Personel Performansı. Kaynak çağrı örnekleri `src/pages/DailyProductionAnalytics.tsx:808`, `src/pages/ShipmentAnalytics.tsx:796`, `src/pages/WasteAnalytics.tsx:785`, `src/pages/CostAnalytics.tsx:876`, `src/pages/WarehousePerformanceAnalytics.tsx:681`, `src/pages/PersonnelPerformanceAnalytics.tsx:677`; haftalık ekran import’u `src/pages/WeeklyProductionAnalytics.tsx:7`.

## 4. Boş veriyle çökme taraması ve hata olmayan boş durumlar

**Demoyu durdurmaz — incelenen boş veri yollarında aktif çekirdek render çökmesi doğrulanmadı.** Bu sonuç kaynak/AST ve seçilmiş bellek kontrolleridir; bütün ekranların gerçek tarayıcıda çalıştırıldığı anlamına gelmez.

| Kontrol | Sonuç ve kanıt |
| --- | --- |
| Sayfalarda boş `reduce` | 169 TSX içindeki **319 reduce çağrısının tamamında başlangıç değeri** var. Örnekler `src/pages/AttendanceTracking.tsx:191`, `:196`; boş liste bu toplamları sıfır yapar. |
| Sayfalarda `.find(...)!` | Böyle bir non-null assertion bulunmadı. Reçete/iş emri/sevkiyat seçimi null dönüşünü korur: `src/pages/ProductionRecipes.tsx:118`, `src/pages/WorkOrders.tsx:189`, `src/pages/Sevkiyatlar.tsx:210`. |
| Doğrudan `[0].alan` | Sayfalarda 13 aday incelendi. Aktif şube yetkisi varsayılanları boyut kontrolü sonrası: `src/pages/BranchPermissions.tsx:102`, `:103`, `:108`, `:109`. Haftalık analiz `src/pages/WeeklyProductionAnalytics.tsx:698` içindeki `[0]`, boş tenant listesinin ilk kaydı değil, Map giriş çiftinin anahtarıdır. |
| Sayfa dışı başlangıçsız reduce | `src/tenant-export/backup-log.ts:134` öncesinde boş kayıt kontrolü `:126` var. Bellekte boş yedek listesi kontrollü “henüz yedek yok” sonucu verdi. |
| Sayfa dışı `.find(...)!` | `src/marketplace/marketplace-category.registry.ts:116` sabit `other` kategori kaydına aittir; yeni tenantın iş kaydı değildir. |
| Boş ilk eleman adayları | Guard’lı örnekler: `src/components/RecipeForm.tsx:129`, `src/components/StockMovementForm.tsx:70`, `src/components/StockWasteForm.tsx:48`, `src/design-system/Charts.tsx:267`. |
| Boş hesaplar | Bellekte `sumBy([], f)=0`, `averageBy([], f)=0`, `percent(0, 0)=0`: `src/kpi-reporting/kpi.utils.ts:29`, `:33`, `:37`. Boş tarihsel maliyet özeti sıfır maliyet/boş seri: `src/recipe-management/recipe-cost-snapshot.service.ts:564`, `:567`. |

Aşağıdaki boş ekran davranışları açık ön koşul veya ilk kayıt yolu sunduğundan eksik seed/boş ekran bulgusu sayılmadı; **demoyu durdurmaz**:

- Kontrol paneli boş defteri ve stok kartı/tedarikçi/mal kabul sırasını açıklar: `src/pages/KontrolPaneli.tsx:591`, `:595`. Hostun genel paneli budur (`src/modules/BusinessWorkspaceRouteHost.tsx:279`).
- HACCP ölçüm yokken sahte uygunluk yüzdesi göstermez; “bugün ölçüm yok” yazar: `src/pages/Haccp.tsx:295`. 0079 plan/CCP oluşturur, ölçüm kaydının kullanıcı tarafından girilmesi beklenir.
- Müşteri ve tedarikçi boş durumda ilk kaydı eklemeyi söyler ve düğme sunar: `src/pages/Musteriler.tsx:342`, `:386`; `src/pages/Suppliers.tsx:179`, `:222`.
- Sipariş, müşteri/stok ön koşullarını gösterir; ikisi dolmadan gerçek form açılmaz: `src/pages/Siparisler.tsx:603`, `:610`, `:620`, `:634`.
- Sevkiyat müşteri eksiğini/ekleme yerini açıklar: `src/pages/Sevkiyatlar.tsx:1242`; araçsız sevkiyat açılabileceğini belirtir (`:1319`).
- Gerçek Analiz boş sevkiyat/fire sonuçlarını açıklar: `src/pages/Analiz.tsx:306`, `:419`; hostun `kpi-dashboard` rotası bu bileşeni açar (`src/modules/BusinessWorkspaceRouteHost.tsx:437`).
- Dondurulmuş `LabelManagement` ilk şablona doğrudan erişir (`src/pages/LabelManagement.tsx:88`, `:100`); kaynak beş sabit aktif şablondur (`src/label-management/label-template.service.ts:41`, `:104`). Tenant iş kaydı boşluğuna bağlı değildir; ayrıca host dondurulmuş rotayı reddeder (`src/modules/BusinessWorkspaceRouteHost.tsx:232`).

## 5. Genel seed sanılmaması gereken INSERT’ler

**Demoyu durdurmaz — bu satırların yeni tenantta otomatik doğmaması tek başına eksik seed değildir.**

- **İlk MIYOP kurulumu:** `db/migrations/0008_ilk_yonetici.sql:32`, `:38`, `:47`, `:65` tek başlangıç şirketi/şubesi/kullanıcısı/erişimidir. Her tenant için tasarlanmamıştır; yeni işletme karşılıkları 0035/0039’daki normal kurulum yollarıdır.
- **İşlem sonuçları:** audit log (`db/migrations/0028_denetim_ozeti.sql:153`), rol ataması (`db/migrations/0015_departman_rolleri.sql:259`), sipariş olayları (`db/migrations/0050_siparis_defteri.sql:530`), portal siparişleri (`db/migrations/0054_musteri_portali.sql:403`), alerjen beyanı (`db/migrations/0073_beyan_yetkisi_ve_roller.sql:227`), personel hesabı (`db/migrations/0076_personel_hesabi.sql:184`) ilgili işlem yapılınca doğar. Boş tenantta önceden iş belgesi bulunması beklenmez.
- **Doğrulama satırları:** 0004, 0031, 0032, 0043 ve 0049 içindeki sınama INSERT’leri yeni müşterinin iş verisi değildir. Örnekler `db/migrations/0004_dogrulama.sql:62`, `db/migrations/0031_hata_kaydi_saklama.sql:75`, `db/migrations/0032_basvuru.sql:310`, `db/migrations/0043_lisans_defteri.sql:365`, `db/migrations/0049_sevkiyat_musteri_karti.sql:112`.
- **Yardımcı betikler:** `g7_1_sema`, `g7_2_veri`, `i12_canli_sinama` sınama kapsamındadır (`db/migrations/README.md:25`, `:29`; `db/migrations/g7_2_veri.sql:4`; `db/migrations/i12_canli_sinama.sql:4`). Bunlardaki test stokları yeni müşteri seed’i değildir.
- **Global kataloglar:** tenant’a kopyalanmaz; yeni tenant aynı kayıtları kullanır. İlk rol/izin/birim kataloglarının ortak okuma niteliği `db/migrations/0005_referans_tablolari.sql:9` üzerindedir. Katalog seed kaynakları aşağıda.

| Global katalog | INSERT kanıtları | Yeni tenant sonucu / demo etkisi |
| --- | --- | --- |
| `permission`, `role`, `role_permission` | `db/migrations/0001_kimlik_ve_tenant.sql:231`, `:243`, `:248`; `db/migrations/0014_izin_katalogu.sql:32`, `:46`, `:56`; `db/migrations/0015_departman_rolleri.sql:27`, `:46`, `:84`; ek izin/rol `db/migrations/0061_siparis_onay_izni.sql:39`, `db/migrations/0068_olcumu_olcen_girsin.sql:33`, `db/migrations/0073_beyan_yetkisi_ve_roller.sql:38`, `:45` | Global kayıtlar mevcut; tenant kopyası gerekmiyor. **Durdurmaz.** |
| `uom`, `uom_conversion` | `db/migrations/0002_birimler.sql:28`, `:39`, `:51`; ambalaj birimleri `db/migrations/0059_ambalaj_birimleri.sql:21`, `:30` | Yeni tenant da ortak birimleri kullanır. **Durdurmaz.** |
| `license_package`, `license_package_module` | `db/migrations/0042_lisans.sql:99`, `:109`, `:116` | Lisans açma helper’ı ortak paketi seçer. **Durdurmaz.** |
| `allergen` | `db/migrations/0057_alerjen_ve_besin_degeri.sql:43` | Ortak alerjen katalog seed’i var. Ürünün alerjen beyanı ayrı kullanıcı işlemidir. **Durdurmaz.** |

## Ek A — tenant_id tablolarına yazan 78 INSERT’in tamamı

Bu envanter yalnız varsayılan seed’leri değil, ayıklanan kurulum/işlem/doğrulama ifadelerini de gösterir. Her genel seed için yeni tenantın tetik/fonksiyon yolu verilmiştir. Eski fonksiyon gövdeleri tarihsel kaynak olarak listelenmiştir; daha sonraki göçün güncel tanımı Bölüm 1’de esas alınmıştır. Bu satırların normal yeni işletme akışındaki demo etkisi **durdurmaz**; yalnız tenant satırıyla kurulumun koşullu engeli Bölüm 2’de, ekran bulguları Bölüm 3’te ayrıca işaretlenmiştir.

| INSERT kanıtı | Hedef tablo | Sınıf | Yeni kiracı değerlendirmesi |
| --- | --- | --- | --- |
| `db/migrations/0004_dogrulama.sql:62` | `company` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:65` | `branch` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:68` | `stock_item` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:72` | `stock_lot` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:80` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:87` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:115` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:147` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:161` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:176` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:190` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0004_dogrulama.sql:204` | `branch` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0008_ilk_yonetici.sql:32` | `company` | Tek MIYOP başlangıç kurulumu | Her tenant için tasarlanmamış. Karşılıkları onay/hesap açmada: `db/migrations/0035_basvuru_onayi.sql:161`, `:176`; `db/migrations/0039_isletme_kullanicisi.sql:155`, `:170`. |
| `db/migrations/0008_ilk_yonetici.sql:38` | `branch` | Tek MIYOP başlangıç kurulumu | Her tenant için tasarlanmamış. Karşılıkları onay/hesap açmada: `db/migrations/0035_basvuru_onayi.sql:161`, `:176`; `db/migrations/0039_isletme_kullanicisi.sql:155`, `:170`. |
| `db/migrations/0008_ilk_yonetici.sql:47` | `app_user` | Tek MIYOP başlangıç kurulumu | Her tenant için tasarlanmamış. Karşılıkları onay/hesap açmada: `db/migrations/0035_basvuru_onayi.sql:161`, `:176`; `db/migrations/0039_isletme_kullanicisi.sql:155`, `:170`. |
| `db/migrations/0008_ilk_yonetici.sql:65` | `user_branch_access` | Tek MIYOP başlangıç kurulumu | Her tenant için tasarlanmamış. Karşılıkları onay/hesap açmada: `db/migrations/0035_basvuru_onayi.sql:161`, `:176`; `db/migrations/0039_isletme_kullanicisi.sql:155`, `:170`. |
| `db/migrations/0015_departman_rolleri.sql:259` | `user_role` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0024_haccp.sql:253` | `haccp_plan` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0079_yeni_kiraci_haccp.sql:141` → `:135` → `:53`. |
| `db/migrations/0024_haccp.sql:259` | `haccp_ccp` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0079_yeni_kiraci_haccp.sql:141` → `:135` → `:70`. |
| `db/migrations/0027_denetim_kaydi.sql:211` | `audit_log` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0028_denetim_ozeti.sql:153` | `audit_log` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0031_hata_kaydi_saklama.sql:75` | `client_error` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0031_hata_kaydi_saklama.sql:92` | `client_error` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0032_basvuru.sql:310` | `business_application` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0032_basvuru.sql:326` | `business_application` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0033_basvuru_gonder.sql:117` | `business_application` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0035_basvuru_onayi.sql:161` | `company` | Yeni işletme kurulum işlemi | İlgili onay/hesap açma fonksiyonu yeni işletmede çalışır; otomatik her tenant tablosu seed’i değildir. |
| `db/migrations/0035_basvuru_onayi.sql:176` | `branch` | Yeni işletme kurulum işlemi | İlgili onay/hesap açma fonksiyonu yeni işletmede çalışır; otomatik her tenant tablosu seed’i değildir. |
| `db/migrations/0038_basvuru_alanlari.sql:127` | `business_application` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0039_isletme_kullanicisi.sql:155` | `app_user` | Yeni işletme kurulum işlemi | İlgili onay/hesap açma fonksiyonu yeni işletmede çalışır; otomatik her tenant tablosu seed’i değildir. |
| `db/migrations/0039_isletme_kullanicisi.sql:166` | `user_role` | Yeni işletme kurulum işlemi | İlgili onay/hesap açma fonksiyonu yeni işletmede çalışır; otomatik her tenant tablosu seed’i değildir. |
| `db/migrations/0039_isletme_kullanicisi.sql:170` | `user_branch_access` | Yeni işletme kurulum işlemi | İlgili onay/hesap açma fonksiyonu yeni işletmede çalışır; otomatik her tenant tablosu seed’i değildir. |
| `db/migrations/0042_lisans.sql:178` | `tenant_license` | Kiracı varsayılanı | Company AFTER INSERT: `db/migrations/0042_lisans.sql:204` → `:199` → güncel `db/migrations/0043_lisans_defteri.sql:149`. |
| `db/migrations/0043_lisans_defteri.sql:106` | `license_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0043_lisans_defteri.sql:149` | `tenant_license` | Kiracı varsayılanı | Company AFTER INSERT: `db/migrations/0042_lisans.sql:204` → `:199` → güncel `db/migrations/0043_lisans_defteri.sql:149`. |
| `db/migrations/0043_lisans_defteri.sql:365` | `license_event` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0044_lisans_ucretli_ucretsiz.sql:75` | `license_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0049_sevkiyat_musteri_karti.sql:112` | `shipment` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/0050_siparis_defteri.sql:530` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0050_siparis_defteri.sql:533` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0050_siparis_defteri.sql:538` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0050_siparis_defteri.sql:546` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0050_siparis_defteri.sql:551` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0053_siparis_onay_zinciri.sql:308` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0053_siparis_onay_zinciri.sql:338` | `order_approval_step` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0053_siparis_onay_zinciri.sql:381` → `:375` → güncel `db/migrations/0061_siparis_onay_izni.sql:71`. |
| `db/migrations/0054_musteri_portali.sql:403` | `sales_order` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0054_musteri_portali.sql:416` | `sales_order_revision` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0054_musteri_portali.sql:439` | `sales_order_line` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0055_revizyon_onayi_dusurur.sql:92` | `sales_order_event` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0061_siparis_onay_izni.sql:71` | `order_approval_step` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0053_siparis_onay_zinciri.sql:381` → `:375` → güncel `db/migrations/0061_siparis_onay_izni.sql:71`. |
| `db/migrations/0063_portaldan_siparis_guncelleme.sql:205` | `sales_order_revision` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0063_portaldan_siparis_guncelleme.sql:232` | `sales_order_line` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0072_alerjen_beyani_atomik.sql:128` | `stock_item_allergen` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0073_beyan_yetkisi_ve_roller.sql:227` | `stock_item_allergen` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0076_personel_hesabi.sql:184` | `app_user` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0076_personel_hesabi.sql:197` | `user_role` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0076_personel_hesabi.sql:214` | `user_branch_access` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0076_personel_hesabi.sql:226` | `user_branch_access` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/0079_yeni_kiraci_haccp.sql:53` | `haccp_plan` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0079_yeni_kiraci_haccp.sql:141` → `:135` → `:53`. |
| `db/migrations/0079_yeni_kiraci_haccp.sql:70` | `haccp_ccp` | Kiracı varsayılanı | Tenant AFTER INSERT: `db/migrations/0079_yeni_kiraci_haccp.sql:141` → `:135` → `:70`. |
| `db/migrations/demo_musteri_kur.sql:68` | `company` | Tek demo işletmesi kurma betiği | Yalnız bu betikle açılan tenant için; tenant/company tetikleri varsayılanları da kurar. |
| `db/migrations/demo_musteri_kur.sql:76` | `branch` | Tek demo işletmesi kurma betiği | Yalnız bu betikle açılan tenant için; tenant/company tetikleri varsayılanları da kurar. |
| `db/migrations/demo_musteri_kur.sql:88` | `app_user` | Tek demo işletmesi kurma betiği | Yalnız bu betikle açılan tenant için; tenant/company tetikleri varsayılanları da kurar. |
| `db/migrations/g7_1_sema.sql:1784` | `user_role` | İşlem / RPC / tetik sonucu | İlgili işlem/RPC/tetik çalışınca yazılır; yeni tenantın başlangıç kaydı değildir. |
| `db/migrations/g7_2_veri.sql:60` | `company` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:65` | `branch` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:72` | `app_user` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:83` | `company` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:88` | `branch` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:95` | `app_user` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:104` | `stock_item` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:109` | `stock_item` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/g7_2_veri.sql:115` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/i12_canli_sinama.sql:42` | `stock_item` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/i12_canli_sinama.sql:48` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/i12_canli_sinama.sql:64` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/i12_canli_sinama.sql:83` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |
| `db/migrations/i12_canli_sinama.sql:99` | `stock_movement` | Doğrulama / test verisi | Test/doğrulama satırı; yeni tenant için doğması beklenmez. |

