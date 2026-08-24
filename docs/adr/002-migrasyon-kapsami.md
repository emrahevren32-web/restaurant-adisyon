# ADR-002 · Migrasyon kapsamı ve dondurma listesi

- **Durum:** Kabul edildi (Claude · GPT · Emrah, 2026-08-23)
- **Ölçüm:** `business-workspace.registry.ts` içinde **34 modül**, **138 menü ögesi**
- **Karar:** 34 modülün **12'si** migre edilir, **22'si** dondurulur

---

## Bağlam

MİYOP bugün 147 ekran taşıyor ve hiçbiri gerçek bir veri katmanına bağlı değil.
Bu ekranların tamamını backend'e taşımak, tamamlanmamış işi çoğaltmak olur.

Kod tabanında ayrıca **iki ayrı veri gerçekliği** var:

- `storage.ts` — 60 adet `ra_*` koleksiyonu
- Modül klasörleri — `goods-receipt.service.ts` kendi anahtarını (`ra_goods_receipt_management`)
  tanımlıyor ve `storage.ts`'ten **hiçbir şey import etmiyor**
- `inventory-lots/` ve `production-work-orders/` klasörlerinde yalnızca `.mock.ts` var

Bu bölünmeyi olduğu gibi PostgreSQL'e taşımak, düzeltmesi on kat pahalı bir hata olurdu.

---

## Karar

Migrasyon kapsamı **Endüstriyel Mutfak çekirdeği** ile sınırlıdır.

**Dondurma ≠ silme.** Kapsam dışı modüllerin kodu repoda kalır. Dondurulmuş bir modül:

- rota seviyesinde kapalıdır,
- menüde görünmez,
- migrasyon kapsamının dışındadır,
- **üzerinde hiçbir geliştirme yapılmaz.**

Çekirdek bittikten sonra sırayla geri açılırlar. O zaman her biri haftalar değil günler
alır, çünkü altındaki zemin sağlam olacaktır.

---

## Kapsam içi — 12 modül

| Modül anahtarı | Ekranlar | Dilim |
|---|---|---|
| `system-dashboard` | Kontrol Paneli | 4 (yeniden yazılır) |
| `system-users` | Kullanıcılar | 0 |
| `system-roles` | Roller | 0 |
| `business-multi-branch` | Şube Yönetimi, Şube Yetkilendirme | 0 |
| `system-audit` | Audit / işlem geçmişi | 0 |
| `system-settings` | Sistem Ayarları — **yalnızca** tenant temel ayarları | 0 |
| `business-stock` | Stok Kartları, Stok Hareketleri, Kritik Stok, Geçerlilik Takibi, Lot/Batch Yönetimi, Mal Kabul | 1, 2 |
| `business-recipe` | Reçete Yönetimi | 3 |
| `business-purchase` | **Yalnızca:** Satın Alma Talepleri, Satın Alma Siparişleri, Tedarikçiler | 2 |
| `business-production-work-orders` | **Yalnızca:** Üretim İş Emri yürütme | 3 |
| `business-logistics` | **Yalnızca:** Sevkiyat yürütme, İrsaliye | 4 |
| `business-quality` | **Yalnızca:** Lot Sistemi, Geri Çağırma, Ürün Geçmişi | 5 |

`system-dashboard` (Kontrol Paneli) kapsamdadır ancak **yeniden yazılır**: yalnızca
defterden okuyan, gerçek rakam gösteren tek bir sayfa olur. Bugünkü hâli taşınmaz.

> **Uygulama notu (2026-08-24):** `system-branches` modülü listeden çıkarıldı ve donduruldu.
> Tek menü ögesi (`branches`) ile `business-multi-branch` içindeki `branch-directory`
> **aynı rotayı** (`branches`) açıyordu; menüde aynı ekrana giden iki giriş bırakmak
> yerine, zengin olanı (Şube Yönetimi) tutuldu. Rota erişimi kaybolmadı.

**Gerçekleşen görünür menü ögesi sayısı: 24** (hedef bandı 24–26 idi).

| Modül | Görünür öge |
|---|---|
| `system-dashboard` | 1 |
| `system-users` · `system-roles` · `system-audit` · `system-settings` | 4 |
| `business-stock` | 6 |
| `business-recipe` | 1 |
| `business-purchase` | 3 |
| `business-quality` | 3 |
| `business-production-work-orders` | 1 |
| `business-logistics` | 3 |
| `business-multi-branch` | 2 |

---

## Dondurulanlar — 22 modül

### Restoran POS tarafı
Depodaki her anahtar `ra_` (*restaurant-adisyon*) önekiyle başlıyor. MİYOP bugün
bir restoran POS'unun iskeleti üzerinde endüstriyel mutfak ERP'si taşıyor.
Sattığımız ürün endüstriyel mutfak; bu taraf donuyor.

| Modül | İçerik |
|---|---|
| `business-adisyon` | Alanlar, İşlemler, Ürün/Hizmetler, Hazırlık Ekranı, Geçmiş |
| `business-qr-menu` | Dijital Talepler, Görevli Çağrıları, QR Kodlar |

### Analitik ve yapay zekâ
Bunlar gerçek veri olmadan zaten anlamsız. Defter dolduktan **sonra** yazıldıklarında
doğru olurlar; şimdi yazılırlarsa uydurma olurlar.

| Modül | İçerik |
|---|---|
| `business-kpi-reporting` | KPI Dashboard + 7 analiz ekranı |
| `business-decision-support-workspace` | Karar Destek, Tahminleme, Öneri Motoru, AI Analizi, Maliyet Optimizasyonu + 5 ekran |
| `business-manager-alerts` | Yönetici alarmları |
| `business-warehouse` | Stok ve Risk Merkezi |

### Finans ve personel
Ayrı bir ürün yüzeyi. Çekirdek zincirle bağı zayıf.

| Modül | İçerik |
|---|---|
| `business-current` | Cari hesaplar |
| `business-credit` | Veresiye |
| `business-finance` | Kasa, gelir-gider, kasa kapanış |
| `business-personnel` | Personel, vardiya, puantaj, performans, prim |

### Platform ve kurumsal
İlk sürümde tek tenant'ı Emrah elle kurar. Self-servis platform sonra gelir.

| Modül | İçerik |
|---|---|
| `system-workspace-welcome` | Karşılama |
| `system-workspace` | Çalışma Alanı |
| `system-marketplace` | Modül Mağazası |
| `system-integration-center` | Entegrasyon Merkezi |
| `system-tools` | Excel Merkezi ve araçlar |
| `system-executive-center` | Executive Dashboard |
| `system-license` | Lisans |
| `system-subscription` | Abonelik |
| `system-support` | Destek |
| `system-ai-center` | AI Merkezi |
| `system-notifications` | Bildirimler |

### Kalite modülünün kalan kısmı
`business-quality` içinden yalnızca üçü kapsamda. Donan kısım:
HACCP, Kalite Kontrol, Kalite Kontrol Formları, Numune Takibi, Şahit Numune,
Operasyon Kontrol Listeleri, Etiket Yönetimi, Fire Yönetimi, Red ve İade Süreci,
Tedarikçi İade Süreci, Kimyasal Ürünler.

> **Not:** HACCP endüstriyel mutfak için önemli ve satış argümanı. Ancak izlenebilirlik
> altyapısı (Dilim 5) kurulmadan yazılan bir HACCP modülü form doldurma ekranından ibaret
> kalır. Defter hazır olduğunda HACCP ilk geri açılacak modüldür.

### Satın alma modülünün kalan kısmı
Teklif Yönetimi, Satın Alma Onayları, Tedarikçi Performansı, Procurement Analytics.

### Üretim modülünün kalan kısmı
Üretim Planlama, Kapasite Planlama, Makine Çizelgeleme, Darboğaz Analizi, Ara Ürünler,
Üretim Hatları.

### Lojistik modülünün kalan kısmı
Sevkiyat Planlama, Araç Planlama, Palet Yönetimi, Sevkiyat İade, Sevkiyat İş Emirleri,
Sevkiyat Optimizasyonu.

---

## Uygulama şekli

> **Düzeltme (2026-08-24, kod incelendikten sonra):** İlk taslakta `scope: 'core' | 'frozen'`
> yazmıştım. Bu ad kullanılamaz — `WorkspaceModuleRegistryItem` üzerinde **zaten bir `scope`
> alanı var** ve `SYSTEM | BUSINESS | PLATFORM` anlamına geliyor. Alan adı
> **`foundationScope`** olarak değiştirildi.

### Alan

`module-registry.types.ts` içinde iki tipe eklenir — modül ve menü ögesi seviyesinde:

```ts
export type FoundationScope = 'core' | 'frozen'

// WorkspaceModuleRegistryItem ve WorkspaceModuleMenuItem üzerinde:
foundationScope: FoundationScope        // modülde zorunlu
foundationScope?: FoundationScope       // menü ögesinde opsiyonel, modülden miras alır
```

Modülde **zorunlu** olması bilinçli: belirtmeyen modül derlenmez, yani yeni bir modül
sessizce kapsama sızamaz.

### Neden mevcut bayraklar kullanılmıyor

Registry'de `isEnabled` ve `isVisible` alanları da var, ama bunlar **lisans ve
marketplace** kavramları — `createLicensedNavModuleMap()` bunları müşterinin neyi satın
aldığını belirlemek için okuyor. "Müşteri bu modülü lisanslamamış" ile "biz bu modülü
henüz bitirmedik" farklı şeylerdir; ikisini aynı bayrakta birleştirmek, ileride lisans
motorunu kurarken çözülmesi güç bir karışıklık üretir.

### Süzme noktaları

Dondurma **üç yerde**, hepsi tek satırlık:

| Ne | Dosya | Fonksiyon |
|---|---|---|
| Modül menüde görünmesin | `navigation/workspace-navigation.registry.ts` | `shouldIncludeModule()` |
| Menü ögesi görünmesin | aynı dosya | `createMenuNode()` — `visible` hesabı |
| Rota açılmasın | `modules/BusinessWorkspaceRouteHost.tsx` + `App.tsx` | rota kümesi |

`shouldIncludeModule()` tüm navigasyon üretiminin tek geçiş kapısı; oraya eklenen bir
koşul sistem, iş ve entegrasyon modüllerinin hepsini birden kapsar.

Rota tarafında `BusinessWorkspaceRouteHost` içinde **121 adet `route === '...'`** dalı
var. Bunların hiçbirine dokunulmaz; bunun yerine bileşenin girişine dondurulmuş rotaları
reddeden tek bir koruma konur ve `App.tsx`'teki rota kümesinden frozen rotalar çıkarılır.

### Rota beyaz listesi

Rota tarafında kara liste değil **beyaz liste** kullanıldı: rotalar paylaşılıyor
(`stock-movements` hem core `stock-movements` hem frozen `waste` ögesinin hedefi), bu
yüzden "hangi rota kapalı" değil "hangi rota açık" sorusu soruluyor.
`getCoreWorkspaceRoutes()` bunu registry'den türetir; `App.tsx` tek kaynak olarak onu
kullanır, `BusinessWorkspaceRouteHost` ise `isFrozenWorkspaceRoute()` ile ikinci savunma
hattını kurar.

Navigasyonda görünmeyen ama erişilebilir kalması gereken beş rota
`NON_NAV_CORE_ROUTES` içinde ayrıca listelenir: `workspace-welcome` (kurulum tamamlanmamış
kullanıcının indiği ekran — erişilemezse giriş akışı kırılır), `my-profile`,
`company-profile`, `marketplace` ve `integration-center` (Kontrol Paneli üzerindeki
butonlardan açılıyorlar; ölü buton bırakmamak için açık, Dilim 4'te panel yeniden
yazılırken butonlarla birlikte kalkacaklar).

### Bu bir kod kararıdır

`localStorage` bayrağı, ortam değişkeni veya kullanıcı ayarı **değildir** — yanlışlıkla
açılabilecek bir kapı bırakmıyoruz. Geri açma da tek satır değildir: bir modül,
ekranları gerçek veriye bağlanmadan ve testleri yazılmadan `'core'` olamaz.
Bu kural `PLAN.md` §1'in birinci maddesidir.

---

## Sonuçlar

**Kabul ettiğimiz bedel:** Uygulama görsel olarak küçülecek. 138 menü ögesi 24-26'ya
inecek. Bu, ilk bakışta geri adım gibi görünür.

**Karşılığında aldığımız:** Menüdeki her ögenin gerçekten çalıştığı bir ürün.
Demoda hiçbir ekranın "burası henüz bağlı değil" cümlesini gerektirmemesi.

İkisi arasında seçim yapıldı ve seçim ikincisidir. Bir müşteri 26 çalışan ekran görüp
"az ama sağlam" der; 138 ekran görüp 11'incisinde boşluğa düşerse "bu ürün hazır değil" der.
Birinci cümleden satış çıkar, ikincisinden çıkmaz.

---

## Reddedilen alternatifler

| Alternatif | Neden reddedildi |
|-----------|------------------|
| 147 ekranın tamamını taşı | Tamamlanmamış işi çoğaltmak. Hiçbiri gerçek veriye bağlı değil. |
| Kapsam dışı ekranları sil | Alan bilgisi o kodun içinde. Silmek bilgiyi atmaktır. |
| Ekranları göster ama "yakında" etiketle | `PLAN.md` §1.3'e aykırı. Vaat edilen her şey çalışır. |
| Kapsamı kullanıcı ayarıyla aç/kapat | Yanlışlıkla açılabilecek kapı. Kapsam kod kararıdır, tercih değil. |
