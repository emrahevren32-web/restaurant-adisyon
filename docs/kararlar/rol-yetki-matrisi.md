# Rol, yetki ve istisna matrisi

> **Bu belge ELLE YAZILMADI, ÖLÇÜLDÜ.** Kaynağı canlı şemanın aynısı olan
> prova veritabanıdır. Yeniden üretmek için:
> ```bash
> bash db/prova/kur.sh
> su postgres -c "psql -q -d miyop -f db/prova/rol-yetki-raporu.sql"
> ```
> ⚠️ Elle sürdürülen bir yetki matrisi bir hafta içinde bayatlar ve bayat
> bir yetki belgesi, **olmayan bir güvenlik duygusu** verir (tuzak 186).
> Bu dosyadaki her sayı ve her liste yukarıdaki raporun çıktısıdır.

Ölçüm tarihi: **8 Kasım 2026** · göç **0108** · **13 rol**, **35 izin**, **28 tabloda yazma kapısı**

---

## Üç kapı kuralı — her yetkinin üç ayrı yeri var

| Kapı | Nerede | Ne işe yarar |
|---|---|---|
| **Menü kaydı** | `business-workspace.registry.ts` | Çalışmayacak düğmeyi göstermemek |
| **Rota kapısı** | `route-permission.ts` | Adresi elle yazarak girmeyi engellemek |
| **Veritabanı kapısı** | tetik + RLS politikası | **ASIL SINIR.** Ekranı atlayan isteği reddeder |

⚠️ İlk ikisi tarayıcıda çalışır, yani **güvenlik sınırı değildir**.
Gerçek koruma veritabanındadır. Üçü ayrıştığında ya kullanıcı sebebini
anlamadan reddedilir, ya da ekranda gizlenen şey API'den okunur.

---

## 1 · Roller

| Rol kodu | Ad | İzin | Ne yapar, ne yapamaz |
|---|---|---:|---|
| `admin` | Platform Sahibi (Yönetici) | 35 | Bu kurulumun sahibi. Platform yönetimi dahil her şeyi yapabilir. Müşteri firmalarının sahiplerine bu rol VERİLMEZ — onlar "İşletme Sahibi" rolünü alır. |
| `depo_sorumlusu` | Depo Sorumlusu | 11 | Mal kabul eder, sayım yapar, depodan mal çıkarır, sevkiyat yürütür. Fiyat ve maliyet GÖRMEZ; reçete ve etiket beyanı YAZAMAZ. |
| `gida_muhendisi` | Gıda Mühendisi | 12 | Etiket beyanını (alerjen, besin değeri) ve kalite kaydını yazar; reçeteyi, üretimi ve stoğu görür. Reçeteyi DEĞİŞTİREMEZ: alerjen reçeteden türetildiği için beyanı yazan kişi reçeteye de dokunabilseydi beyan kendi kendini doğrulardı. |
| `isletme_muduru` | İşletme Müdürü | 29 | İşletmenin bütün operasyonunu yürütür ve maliyeti görür. Kullanıcı açamaz, rol dağıtamaz, işletme ayarlarını değiştiremez — o yetki işletme sahibinde kalır. |
| `isletme_sahibi` | İşletme Sahibi | 33 | Kendi işletmesinde her şeyi yapar: kullanıcı açar, rol dağıtır, fiyat ve maliyet görür. Platform ayarlarına ve başka işletmelerin verisine ERİŞEMEZ. |
| `izleyici` | Görüntüleyici | 15 | Her şeyi görür, hiçbir şeyi değiştiremez. Denetçi, danışman ve mali müşavir için. Fiyat ve maliyet dahil okuma yetkisi vardır. |
| `kalite_sorumlusu` | Kalite Sorumlusu | 11 | Kalite kaydı ve HACCP ölçümü girer, geri çağırma başlatır, ETİKET BEYANINI (alerjen/besin) yazar, denetim kaydını okur. Üretimi ve stoğu yalnız GÖRÜR — denetleyen, denetlediği veriyi düzeltemez. |
| `muhasebe` | Muhasebe | 8 | Finansı yürütür: kasa, cari, gelir-gider, tedarikçi ödemesi. Satın almayı ve stoğu GÖRÜR ama mala dokunmaz — stok hareketi yazamaz. |
| `personel` | Operasyon Personeli | 7 | Mutfak/depo personeli. Üretim tüketimini düşer, sayım yapar, fireyi kaydeder, reçeteye bakar. MAL KABUL ETMEZ — o depo sorumlusunun işidir. Fiyat, tedarikçi, kullanıcı ve ayar GÖRMEZ; sipariş onaylayamaz. |
| `satinalma_sorumlusu` | Satın Alma Sorumlusu | 7 | Satın alma talebi ve siparişi açar, tedarikçi yönetir, alış fiyatını görür. Depoya mal GİRMEZ (onu mal kabul yapar) ve üretime karışmaz. |
| `sevkiyat_sorumlusu` | Sevkiyat Sorumlusu | 9 | Sevkiyat yürütür, irsaliye keser, yükleme ölçümü girer, mal çıkışı yazar. Sevk ettiği malın ETİKET ve ALERJEN bilgisini görür — yanlış etiketli mal yüklenmesin diye. Fiyat GÖRMEZ; üretime ve satın almaya karışmaz. |
| `super_admin` | Platform Yöneticisi | 35 | EVREN360 platformunun tamamında tam yetki. Bütün işletmeleri ve lisansları yönetir. Yalnız bizde olmalı. |
| `uretim_sorumlusu` | Üretim Sorumlusu | 11 | İş emri açar, üretimi yürütür, hammadde düşer, mamul girer. Ölçüm girer. Reçete yazar. Etiket beyanı (alerjen/besin) YAZAMAZ; satın alma ve finansa erişemez. |

---

## 2 · Rol başına izinler

**`admin` · Platform Sahibi (Yönetici)** (35)

`audit.read, branch.manage, branch.read, company.manage, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, platform.manage, platform.read, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, roles.manage, settings.manage, stock.read, stock.write, users.manage, users.read`

**`depo_sorumlusu` · Depo Sorumlusu** (11)

`branch.read, dashboard.read, logistics.read, logistics.write, production.read, products.read, purchase.read, quality.read, recipe.read, stock.read, stock.write`

**`gida_muhendisi` · Gıda Mühendisi** (12)

`audit.read, branch.read, dashboard.read, logistics.read, production.read, products.read, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, stock.read`

**`isletme_muduru` · İşletme Müdürü** (29)

`audit.read, branch.manage, branch.read, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, stock.read, stock.write, users.read`

**`isletme_sahibi` · İşletme Sahibi** (33)

`audit.read, branch.manage, branch.read, company.manage, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, roles.manage, settings.manage, stock.read, stock.write, users.manage, users.read`

**`izleyici` · Görüntüleyici** (15)

`audit.read, branch.read, company.read, dashboard.read, finance.read, logistics.read, operations.read, personnel.read, production.read, products.read, purchase.read, quality.read, recipe.read, stock.read, users.read`

**`kalite_sorumlusu` · Kalite Sorumlusu** (11)

`audit.read, branch.read, dashboard.read, logistics.read, production.read, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, stock.read`

**`muhasebe` · Muhasebe** (8)

`audit.read, branch.read, company.read, dashboard.read, finance.read, finance.write, purchase.read, stock.read`

**`personel` · Operasyon Personeli** (7)

`dashboard.read, production.read, production.write, products.read, recipe.read, stock.read, stock.write`

**`satinalma_sorumlusu` · Satın Alma Sorumlusu** (7)

`branch.read, dashboard.read, finance.read, products.read, purchase.read, purchase.write, stock.read`

**`sevkiyat_sorumlusu` · Sevkiyat Sorumlusu** (9)

`branch.read, dashboard.read, logistics.read, logistics.write, products.read, quality.read, quality.write, stock.read, stock.write`

**`super_admin` · Platform Yöneticisi** (35)

`audit.read, branch.manage, branch.read, company.manage, company.read, dashboard.read, finance.read, finance.write, logistics.read, logistics.write, operations.approve, operations.read, operations.write, personnel.manage, personnel.read, platform.manage, platform.read, production.read, production.write, products.read, products.write, purchase.read, purchase.write, quality.declaration, quality.read, quality.record.manage, quality.write, recipe.read, recipe.write, roles.manage, settings.manage, stock.read, stock.write, users.manage, users.read`

**`uretim_sorumlusu` · Üretim Sorumlusu** (11)

`branch.read, dashboard.read, production.read, production.write, products.read, quality.read, quality.write, recipe.read, recipe.write, stock.read, stock.write`

---

## 3 · İzin kataloğu — hangi izin kimde

| Modül | İzin | Roller |
|---|---|---|
| audit | `audit.read` | admin, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, muhasebe, super_admin |
| branch | `branch.manage` | admin, isletme_muduru, isletme_sahibi, super_admin |
|  | `branch.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, muhasebe, satinalma_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
| business-workspace | `operations.approve` | admin, isletme_muduru, isletme_sahibi, super_admin |
|  | `operations.read` | admin, isletme_muduru, isletme_sahibi, izleyici, super_admin |
|  | `operations.write` | admin, isletme_muduru, isletme_sahibi, super_admin |
| company | `company.manage` | admin, isletme_sahibi, super_admin |
|  | `company.read` | admin, isletme_muduru, isletme_sahibi, izleyici, muhasebe, super_admin |
| dashboard | `dashboard.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, muhasebe, personel, satinalma_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
| finance | `finance.read` | admin, isletme_muduru, isletme_sahibi, izleyici, muhasebe, satinalma_sorumlusu, super_admin |
|  | `finance.write` | admin, isletme_muduru, isletme_sahibi, muhasebe, super_admin |
| logistics | `logistics.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, sevkiyat_sorumlusu, super_admin |
|  | `logistics.write` | admin, depo_sorumlusu, isletme_muduru, isletme_sahibi, sevkiyat_sorumlusu, super_admin |
| personnel | `personnel.manage` | admin, isletme_muduru, isletme_sahibi, super_admin |
|  | `personnel.read` | admin, isletme_muduru, isletme_sahibi, izleyici, super_admin |
| platform | `platform.manage` | admin, super_admin |
|  | `platform.read` | admin, super_admin |
| production | `production.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, personel, super_admin, uretim_sorumlusu |
|  | `production.write` | admin, isletme_muduru, isletme_sahibi, personel, super_admin, uretim_sorumlusu |
| products | `products.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, personel, satinalma_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
|  | `products.write` | admin, isletme_muduru, isletme_sahibi, super_admin |
| purchase | `purchase.read` | admin, depo_sorumlusu, isletme_muduru, isletme_sahibi, izleyici, muhasebe, satinalma_sorumlusu, super_admin |
|  | `purchase.write` | admin, isletme_muduru, isletme_sahibi, satinalma_sorumlusu, super_admin |
| quality | `quality.declaration` | admin, gida_muhendisi, isletme_muduru, isletme_sahibi, kalite_sorumlusu, super_admin |
|  | `quality.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
|  | `quality.record.manage` | admin, gida_muhendisi, isletme_muduru, isletme_sahibi, kalite_sorumlusu, super_admin |
|  | `quality.write` | admin, gida_muhendisi, isletme_muduru, isletme_sahibi, kalite_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
| recipe | `recipe.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, personel, super_admin, uretim_sorumlusu |
|  | `recipe.write` | admin, isletme_muduru, isletme_sahibi, super_admin, uretim_sorumlusu |
| roles | `roles.manage` | admin, isletme_sahibi, super_admin |
| settings | `settings.manage` | admin, isletme_sahibi, super_admin |
| stock | `stock.read` | admin, depo_sorumlusu, gida_muhendisi, isletme_muduru, isletme_sahibi, izleyici, kalite_sorumlusu, muhasebe, personel, satinalma_sorumlusu, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
|  | `stock.write` | admin, depo_sorumlusu, isletme_muduru, isletme_sahibi, personel, sevkiyat_sorumlusu, super_admin, uretim_sorumlusu |
| users | `users.manage` | admin, isletme_sahibi, super_admin |
|  | `users.read` | admin, isletme_muduru, isletme_sahibi, izleyici, super_admin |

---

## 4 · Veritabanı yazma kapıları (tablo başına)

⚠️ Bunlar `app.izin_gerek_coklu(...)` tetikleridir ve listedeki
izinlerden **herhangi biri** yeterlidir (VEYA).

| Tablo | Gerekli izinlerden biri |
|---|---|
| `customer` | `operations.write` |
| `customer_price` | `operations.write` |
| `delivery_point` | `operations.write` |
| `driver` | `logistics.write` |
| `goods_receipt` | `purchase.write`, `stock.write` |
| `goods_receipt_line` | `purchase.write`, `stock.write` |
| `haccp_ccp` | `quality.record.manage` |
| `haccp_plan` | `quality.record.manage` |
| `order_discrepancy` | `operations.write` |
| `portal_user` | `operations.write` |
| `portal_user_point` | `operations.write` |
| `purchase_order` | `purchase.write` |
| `purchase_order_line` | `purchase.write` |
| `purchase_request` | `purchase.write` |
| `purchase_request_line` | `purchase.write` |
| `sales_order` | `operations.write` |
| `sales_order_line` | `operations.write` |
| `sales_order_revision` | `operations.write` |
| `stock_count` | `stock.write` |
| `stock_count_line` | `stock.write` |
| `stock_item_nutrition` | `quality.declaration`, `products.write`, `stock.write` |
| `supplier` | `purchase.write` |
| `supplier_return` | `purchase.write`, `stock.write` |
| `supplier_return_line` | `purchase.write`, `stock.write` |
| `vehicle` | `logistics.write` |
| `witness_sample` | `quality.record.manage`, `quality.write` |
| `work_order` | `production.write` |
| `work_order_line` | `production.write` |

---

## 5 · Okuma kapısı olan tablolar

Çoğu tabloda okuma sınırı **yalnız kiracı duvarıdır** (`tenant_id`).
Aşağıdakilerde okuma ayrıca **izin** de istiyor:

| Tablo | Komut | Koşul |
|---|---|---|
| `branch` | SELECT | `platform.manage` |
| `business_application` | SELECT, UPDATE | `platform.manage` |
| `business_application_event` | SELECT | `platform.manage` |
| `company` | SELECT, UPDATE | `platform.manage` |
| `tenant` | SELECT | `platform.manage` |
| `witness_sample` | SELECT | kiracı **VE** `quality.read` |
| `witness_sample_event` | SELECT | kiracı **VE** `quality.read` |

⚠️ Şahit numunedeki okuma kapısı **08.11.2026'da göç 0107 ile eklendi**
(Codex bulgusu MIYOP-100). Öncesinde ekranı açamayan bir kullanıcı
numuneleri API'den okuyabiliyordu.

---

## 6 · İSTİSNALAR VE BİLİNÇLİ KARARLAR

Aşağıdakilerin hepsi **tartışılıp verilmiş kararlardır**, kaza değil.
Biri "neden böyle" diye sorduğunda cevap burada.

### 6.1 · Şahit numune — üç ayrı kapı, üç ayrı izin

| İşlem | Gerekli izin | Kim yapabilir |
|---|---|---|
| **Görmek** | `quality.read` | kalite, gıda müh., üretim, **depo**, sevkiyat, müdür, sahip, izleyici |
| **Almak / açmak** | `quality.record.manage` **veya** `quality.write` | kalite, gıda müh., üretim, **sevkiyat**, müdür, sahip |
| **İmha etmek** | yalnız `quality.record.manage` | kalite, gıda müh., müdür, sahip |

- ⚠️ **Depo sorumlusu görür ama yazamaz.** İsmet'in anlattığı akışta
  numune "depocu kontrolünde" tutuluyor — kontrol **fiziksel bir
  sorumluluktur**, kayıt yetkisi değil.
- ⚠️ **İmha dar kapıda** (göç 0097, Emrah kararı): *"Numuneyi siz
  alabilir ve açabilirsiniz, ama imhayı onlar yazar."* Numuneyi alan
  kişinin onu yok edebilmesi, şahit numunenin anlamını bitirirdi.
- ⚠️ **`personel` 08.11'de çıkarıldı** (göç 0108). Sebep ölçüldü:
  `production.write` taşıyıp `quality.read` taşımayan tek rol oydu —
  yazabiliyor ama yazdığını göremiyordu. Emrah: *"b olsun, hiç
  karışmasın."*
- ⚠️ **`sevkiyat_sorumlusu` İSTİSNADIR** (Emrah, 08.11): *"evet.
  Normalde iş onun olmaz ama alabilsin."* 0108 ile `quality.write`
  üzerinden yazabiliyor. Gerekçe: şahit numune çoğu işletmede **sevk
  anında** alınıyor; o rol ekranı zaten görüyordu.
- ✅ **Yazabilen her rol okuyabiliyor da.** Göç 0108 bunu ölçüyor ve
  sağlanmazsa göç duruyor.

### 6.2 · Etiket beyanı — yazan, reçeteye dokunamaz

`quality.declaration` (alerjen ve besin değeri beyanı):
kalite sorumlusu, gıda mühendisi, müdür, sahip.

⚠️ **Gıda mühendisi `recipe.write` TAŞIMIYOR ve bu bilinçli.** Alerjen
reçeteden türetiliyor; beyanı yazan kişi reçeteye de dokunabilseydi
**beyan kendi kendini doğrulardı**.

### 6.3 · Kalite sorumlusu üretimi ve stoğu yalnız GÖRÜR

`production.read` ve `stock.read` var, `*.write` yok.
⚠️ **Denetleyen, denetlediği veriyi düzeltemez.**

### 6.4 · Maliyet ve fiyat kapısı

`finance.read`: müdür, sahip, muhasebe, satın alma, izleyici, admin.
⚠️ Göç 0071 ile **raporların önüne de** kondu: işletme göstergeleri ve
fire dökümü bu izin olmadan MI403 veriyor. Depo sorumlusu, üretim
sorumlusu ve sevkiyat **fiyat görmez**.

### 6.5 · Sipariş onayı ayrı bir haktır

`operations.approve` (göç 0061): müdür, sahip, admin.
⚠️ Sipariş **açmak** (`operations.write`) ile **onaylamak** ayrı iki
hak. Bugün aynı rollerde duruyorlar ama ayrılabilir olmaları o göçün
amacıydı.

### 6.6 · Mal kabul personelde değil

`personel` rolü üretim tüketimi düşer, sayım yapar, fire kaydeder — ama
**mal kabul etmez** (`purchase.*` yok). O depo sorumlusunun işi.

### 6.7 · Platform yetkisi yalnız bizde

`platform.manage` ve `platform.read`: yalnız `admin` ve `super_admin`.
⚠️ Müşteri firmalarının sahiplerine **`admin` rolü VERİLMEZ** — onlar
`isletme_sahibi` alır. `admin`, bu kurulumun sahibi demektir.

### 6.8 · İşletme sahibi ile müdür arasındaki fark

Müdürde olmayan dört hak: `company.manage`, `roles.manage`,
`settings.manage`, `users.manage`.
⚠️ Yani **müdür kullanıcı açamaz ve rol dağıtamaz.** Operasyonun
tamamını yürütür, ama "kim neye yetkili" kararı sahipte kalır.

### 6.9 · İzleyici her şeyi görür, hiçbir şeyi değiştiremez

15 iznin tamamı okuma. Denetçi, danışman ve mali müşavir için.
⚠️ **Fiyat ve maliyet dahil.** Mali müşavirin maliyeti görmemesi
anlamsız olurdu.

---

## 7 · Bu belge bayatlarsa ne olur

⚠️ Yukarıdaki her tablo `db/prova/rol-yetki-raporu.sql` çıktısıdır.
Bir göç yetkileri değiştirdiğinde bu belge **kendiliğinden
güncellenmez** — rapor yeniden koşturulur ve buradaki bölümler
değiştirilir. Rolleri veya izinleri değiştiren her göç bunu kendi
turunda yapmalıdır.

⚠️ `src/core/prova-kosuldu.arch.test.ts` provaların güncel göçlerle
koştuğunu zorluyor; **bu belgeyi zorlayan bir sınama YOK** ve bu
bilerek yazıldı: belge insan için, kapı makine için. Kapının doğruluğu
provalarla ölçülüyor, belgenin güncelliği insanın sorumluluğunda.
