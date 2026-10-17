# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: 17.10.2026, göç **0088** yazıldıktan sonra.
> Commit: `fc342a2` · dal: `production-foundation`

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**90**).
   Her tuzak gerçekten düşülmüş bir hatadır.
2. `docs/kararlar/codex-denetimi-ekim-2026.md` — senin önceki denetiminin
   özeti, hangi bulgular kapandı, hangileri açık
3. `docs/kararlar/calisma-duzeni.md` — sen ve Claude nasıl sırayla çalışır
4. `docs/HEDEFLER.md` — ne yapılıyor, neden, hangi sırayla
5. `docs/yetki-cercevesi.md` — izin ve rol tasarımı
6. `db/migrations/README.md`
7. **Her göç dosyasının BAŞLIK YORUMU.** Kararın gerekçesi orada yazılı,
   bazen yüz satır. Göç numarası büyüdükçe karar yenidir. Bu, bu depodaki
   en zengin karar kaynağıdır.

## 2 · BİLMEN GEREKEN KURALLAR

Bunlar bilinçli kararlar. "Hata" diye raporlama:

- **Mock veri asla olmayacak.** Uydurma veri bulursan P0 say. Ama
  `foundationScope: 'frozen'` ile kapatılmış eski ekranlar kasıtlı
  kapatılmıştır; rotası kapalıysa bulgu değildir.
- **Tarayıcıdaki izin kontrolü güvenlik sınırı DEĞİLDİR.** Gerçek sınır
  veritabanındadır (RLS + GRANT + tetikleyici). Bir ekranın `if` ile
  düğme gizlemesi koruma sayılmaz — zaten öyle olduğunu biliyoruz.
- **Ücretsiz lisans uzatması lisansı "Deneme"de BIRAKIR**, "Aktif" yapmaz.
  Bu bilinçli (göç 0044 başlığında yazılı).
- **Silme yoktur, pasife alma vardır.** Hiçbir tabloda `DELETE` yetkisi
  verilmez; bu tasarım.
- **`NULL = sınırsız`** demektir lisans paketlerinde (kullanıcı/şube
  sayısı). Sayı yazmak teknik bir sınırımız varmış gibi gösterirdi.
- **Sorulmamış soruya varsayılan cevap yazılmaz.** Yeni kolonlar `NULL`
  kabul eder; `default` yazmak uydurma cevabı gerçek gibi kaydetmektir.
- **"Boş" ile "sıfır" ayrı şeylerdir.** Ekranda `—` gösteriliyorsa
  bilinmiyor demektir, 0 demek değildir.

## 3 · NASIL ÇALIŞ

- **Salt okunur denetle. HİÇBİR DOSYAYI DEĞİŞTİRME.** Düzeltmeyi Claude
  yapıyor; o gerçek bir PostgreSQL 16 üzerinde prova koşturabiliyor,
  sen koşturamıyorsun. İkimiz aynı anda yazarsak birbirimizi ezeriz.
- Her bulguda şunlar olsun: **dosya + satır**, somut kanıt (kod parçası),
  etki (ne olur), önerilen çözüm, **kabul kriteri** (düzeldiğini nasıl
  anlarız).
- Önceliklendir: P0 (güvenlik / veri kaybı) · P1 (iş bütünlüğü) ·
  P2 (kalite) · P3 (belge).
- Emin olmadığın şeyi "doğrulanmadı" diye işaretle. Uydurma kanıt üretme.
- Türkçe yaz.

## 4 · BU TURDA BAKILACAK

Önceki turunda bulduğun **MIYOP-031, -032, -035, -037** doğrulandı ve
onarıldı; **MIYOP-002** kapatıldı. Bu turda üç göç var: **0086, 0087, 0088**.

Ayrıca kendi ölçümümle **Codex listesinde olmayan bir tablo** buldum:
`stock_item_nutrition`. 0072 alerjen beyanının doğrudan yazılmasını
kapatmış, besin değeri tablosunu atlamış — ve o tablo gıda etiketine
basılıyor. 0088 onu da kapattı. Bu yüzden 26 değil **27 tablo**.

### 4.1 · 0086 · kırılan iki akış onarıldı mı

`db/migrations/0086_kirilan_akislar_onarildi.sql`

- `app.stok_karti_izni()` — `stock.write` her şeyi açar;
  `quality.declaration` YALNIZ beyan kolonlarını. Kolon listesi yerine
  `(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)` farkı.
  **Soru:** bu karşılaştırma kaçırılabilir mi? Beyanın yanına kaçak bir
  kolon geçirmenin bir yolu var mı? (jsonb anahtar sırası, `null` ile
  "yok" ayrımı, generated/identity kolonlar, `updated_at` tetiği?)
- `app.lot_izni()` — dört izinden biri yeterli.
  **Soru:** lot açan başka bir akış var mı, o akışın rolü bu dörtten
  birine sahip mi?

### 4.2 · 0087 · MIYOP-002 kapandı mı

`db/migrations/0087_onay_imzasi_sunucuda.sql`

**Senin kendi bulgularını hedef alarak bak — bunları henüz DÜZELTMEDİM:**

- **MIYOP-033 (P0, AÇIK)** · onaylanmış bir revizyona satır eklenebiliyor.
  `sales_order_line` INSERT açık; satır tetiği yalnız LOJİSTİK
  revizyonlarını engelliyor. **Doğrula ve kapsamı netleştir:** hangi
  durum geçişlerinde hangi satır işlemleri serbest kalıyor?
- **MIYOP-034 (P0, AÇIK)** · `current_revision` geri alınıp durum
  "Onaylandı" yapılarak eski bir onay yeniden kullanılabiliyor.
  **Doğrula:** `current_revision` kim yazabiliyor, hangi yoldan?
- **MIYOP-036 (P1, AÇIK)** · var olmayan / gelecek bir `revision_no` için
  onay yazılabiliyor; FK yok, 0087 doğrulamıyor.
  Not: `db/prova/prova-0087.sql:35` bu durumu KAPSAMIYOR — biliyorum.

**Ek sorular:** Onay kararını başka bir yoldan yazmak mümkün mü? Zorunlu
bir adımı etkisizleştirmenin başka yolu var mı (`is_active`, satır silme,
yeni adım ekleyip eskisini gölgeleme)?

### 4.3 · 0088 · ÜÇÜNCÜ BİR KIRIK AKIŞ VAR MI — bu turun en kritik sorusu

`db/migrations/0088_kalan_yirmi_alti_tablo.sql`

0085'te kapı taktım, arkasında kimin çalıştığına bakmadım, iki akış
kırdım (tuzak 88). **0088'de 27 tabloya kapı taktım. Aynı hatayı tekrar
yapmış olabilirim ve bunu bulmanı istiyorum.**

Eşleme (tetik argümanı = kabul edilen izinler, herhangi biri yeterli):

| Tablolar | İzin(ler) |
|---|---|
| `supplier`, `purchase_request(_line)`, `purchase_order(_line)` | `purchase.write` |
| `goods_receipt(_line)`, `supplier_return(_line)` | `purchase.write` **veya** `stock.write` |
| `work_order(_line)` | `production.write` |
| `haccp_plan`, `haccp_ccp` | `quality.record.manage` |
| `stock_count(_line)` | `stock.write` |
| `customer`, `delivery_point`, `customer_price`, `sales_order`, `sales_order_revision`, `sales_order_line`, `order_discrepancy`, `portal_user`, `portal_user_point` | `operations.write` |
| `vehicle`, `driver` | `logistics.write` |
| `stock_item_nutrition` | `quality.declaration` **veya** `products.write` **veya** `stock.write` |

**Her tablo için sor:** o tabloya kim yazıyor — hangi ekran, hangi servis,
hangi Edge Function, hangi RPC — ve o yolu kullanan rolün listedeki
izinlerden en az biri var mı? Özellikle bak:

- **Yeni kiracı açılışı ve tohum veri:** 0035, 0039, 0061, 0079,
  `app.onay_zincirini_kur`, ve Edge Function'lar
  (`isletme-hesabi-ac`, `personel-hesabi-ac`). Bunlar `security definer`
  mi, yoksa `authenticated` oturumuyla mı yazıyor? İkincisiyse yeni
  müşteri açılışı 0088'den sonra kırılmış olabilir.
- **İçe aktarma akışları:** `catalog-import`, `supplier-import`,
  `excel-import` — hangi rolle çalışıyorlar?
- **Portal:** müşteri portalı `sales_order` / `order_discrepancy` /
  `portal_user_point` tarafına yazıyor mu? Portal kullanıcısının hangi
  rolü var ve `operations.write` izni var mı? **Varsa bu da bir bulgudur**
  (portal kullanıcısı kiracının iç defterine yazmamalı).
- **Birden fazla tabloya yazan akışlar:** mal kabul (hareket + lot +
  belge), tedarikçi iadesi, sayım uygulaması, iş emri tamamlama. Üç
  tablonun kapısı aynı izin kümesini kabul ediyor mu, yoksa akış yarıda
  mı kalıyor? (Tuzak 88 tam olarak buydu.)

### 4.4 · 0088'in kendi iddiası doğru mu

Göç şunu iddia ediyor: *"`authenticated` rolüne INSERT/UPDATE/DELETE hakkı
olup kapısı olmayan tablo sayısı = 0."* Göç bunu ölçüyor ve 0 değilse
duruyor.

**Bu ölçümü denetle.** Ölçüm şu desene bakıyor: tetik adı `izin\_%` ya da
`%degismez%`. **Sorular:**

- Bu desen yeterli mi? Kapı sayılmaması gereken bir tetik `izin_` ile
  başlıyor olabilir mi (yani ad eşleşiyor ama gerçekte kapı değil)?
- `authenticated` rolü tabloya DOĞRUDAN hak almadan, bir rol üyeliği ya
  da `security definer` fonksiyon üzerinden yazabilir mi? Ölçüm yalnız
  doğrudan `relacl` hakkına bakıyor — **bu bir kör noktadır, kapsamını
  söyle.**
- `app.yetkim_var()` ya da `app.bakim_baglami()` bir şekilde kandırılabilir
  mi? (`app.bakim_baglami()` = oturum yok VE `current_user` anon/
  authenticated değil.) PostgREST üzerinden `current_user`
  `authenticated` olmayan bir yol var mı?
- `app.izin_gerek_coklu()` DELETE'te `coalesce(new, old)` döndürüyor.
  BEFORE DELETE tetiğinde `old` döndürmek silmeye izin verir — doğru
  davranış bu mu, yoksa kapı delete'i yanlış mı ele alıyor?

### 4.5 · MIYOP-035 gerçekten kapandı mı

0088 şunu ekledi: stok kartı **INSERT** edilirken `allergen_reviewed_at`
ya da `allergen_reviewed_by` doluysa MI436 ile duruyor.

**Soru:** damgayı dolaylı yoldan atmanın başka yolu var mı? Önce boş kart
açıp sonra UPDATE ile damgalamak? `public.alerjen_beyani_yaz` dışında
damgaya dokunan bir fonksiyon var mı? Toplu içe aktarma bu kapıyı
dolaşıyor mu?

### 4.6 · BAYAT PROVALAR — ⚠️ ÖNCEKİ BRİFTE YANLIŞ YAZMIŞIM

**Düzeltme.** Önceki brifte "db/prova altındaki 50 dosyanın 11'i geçmiyor"
yazmıştım. İki şey yanlıştı:

1. **Dosyalar depoda değildi.** 0083–0088 dışındakiler yalnız benim
   çalışma ortamımda duruyordu. Senin "bu dosyaların yolu nedir" sorun
   haklıydı. Artık hepsi depoda: `db/prova/` (36 dosya) + çalıştırma
   betikleri + `db/prova/README.md`.
2. **Sayı da yanlıştı.** Doğru ölçüm: **36 dosya · 22 YEŞİL · 14 KIRMIZI.**
   Önceki "11" rakamı zayıf bir tarayıcıdan geliyordu: eski provalar
   başarısızlığı `raise notice '❌ ...'` ile bildiriyor — bu bir NOTICE'tır,
   ERROR değildir, ve tarayıcım görmüyordu. (Aynı aileden bir hata:
   tuzak 89.)

**Şimdi koşturabilirsin:**

```bash
bash db/prova/kur.sh              # PostgreSQL 16 gerekir, root olarak
bash db/prova/hepsini-kosturt.sh
```

Kırık 14 dosya: `prova-0051, 0052, 0055, 0056, 0057, 0058, 0065, 0070,
0071b, 0071c, 0073, 0076, 0077, 0083`. Hiçbiri 0088'den kaynaklanmıyor
(0088 öncesi/sonrası taban çizgisi ayrı ayrı ölçüldü, aynı).
Tahmin edilen nedenler `db/prova/README.md` içinde tablo hâlinde — ama
orada da yazdığım gibi **o tablo tahmindir, teşhis değildir.**

**Senden istediğim:** bu 14 dosyadan hangileri gerçekten bayat, hangileri
**gerçek bir gerilemeyi** gösteriyor? Bu ayrımı yapmanı istiyorum, çünkü
bayat sanıp geçtiğim bir dosya gerçek bir kırığı saklıyor olabilir.
PostgreSQL'in yoksa dosyaları okuyarak da ayırabilirsin: her provanın
iddiası ile bugünkü göç metni çelişiyor mu?

### 4.7 · Hâlâ açık, tekrar raporlamana gerek yok

Kapsamları değiştiyse söyle: **MIYOP-003** (çapraz kiracı + audit
sızıntısı) · **MIYOP-004** (sahte ters kayıt) · **MIYOP-005** (satır
güncellemesinde veri kaybı) · **MIYOP-006** · **MIYOP-017** · **MIYOP-018**.

Sıradaki işim **MIYOP-003**. Onunla ilgili yeni bir ayrıntın varsa öne al.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.3 · Kırılan akış var mı (EN ÖNEMLİ BÖLÜM)
<her akış için: tablo, yazan yol (ekran/servis/RPC/Edge), rol,
 gereken izin, sahip mi, sonuç: ÇALIŞIR / KIRIK / DOĞRULANMADI>

## 4.4 · 0088'in "kapısız yüzey = 0" iddiası
<doğru / eksik + ölçümün kör noktaları>

## 4.6 · Bayat provalar
<11 dosya: BAYAT mı GERÇEK GERİLEME mi, her biri için tek satır gerekçe>

## Yeni bulgular
<MIYOP-031'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```
