# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: **01.11.2026 · göç 0104 + A4 + para birimi turu**.
> Dal: `production-foundation` · son commit: `d70e00c`
> Canlı: **v0.5.1** (`index-CCbKo7YK.js`) · veritabanı **göç 0104**

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**162**).
   Her tuzak gerçekten düşülmüş bir hatadır.
   ⚠️ **153–162'yi mutlaka oku.** Onu da geçip şunu bil: bu on tuzağın
   **yedisi** Claude'un kendi ÖLÇÜM hatasıdır ve hepsi bu turda bakacağın
   kodun yazıldığı 48 saat içinde oldu:
   · 153 Türkçe `lower()` dizgi konumunu kaydırıyor
   · 156 "birkaç yüz MB" dedi, gerçek 8,5 MB
   · 157 yedek dosyası var ama içinde veri yok
   · 158 `git bundle verify` başarıyı stderr'e yazıyor, betik patladı
   · 159 aracın gereksinimini belgede okuyup söylememek (Docker)
   · 161 "SPF kaydı yoksa" dedi — kayıt VARDI ve sorunun sebebiydi
   · 162 yol haritasının özet tablosu ayrıntı bölümünden üç gün gerideydi
   ⚠️ Ve **153'ü 24 saat içinde tekrarladı**: bir modülün `foundationScope`
   değerini bir YORUM satırından okudu, `core` sandı, gerçek değer
   `frozen`'dı. O yanlış ölçümle "sekiz açık ekran uydurma personel
   gösteriyor" diyecekti.
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

## 4 · BU TURDA BAKILACAK · **BİR GÖÇ, 851 SİLİNEN SATIR, BİR ZİNCİR**

Üç gün çalışıldı. Sırayla:

### 4.1 · Göç **0104** — denetim defteri doğru satırı yazıyor (CANLIDA)

`db/migrations/0104_denetim_satir_kimligi.sql` · `db/prova/prova-0104.sql`
ve **`db/prova/prova-0104-ters.sql`**

Kusur (senin bulgun MIYOP-083): `app.denetim_yaz()` satır kimliğini
`coalesce(new->>'id', old->>'id', '?')` ile üretiyordu; `id` kolonu olmayan
dört tabloda `row_id` alanına `'?'` düşüyordu.

Onarım dört tabloyu yamamak değil, **defteri yazan fonksiyonu** düzeltmek:
`id` yoksa birincil anahtardan kimlik üretiliyor.

**Bak:**
- Gövde canlı tanımdan mı alınmış, yoksa "hatırlanarak" mı yazılmış?
  (0028'in kararlarından biri sessizce silinmiş olabilir.)
- `app.denetim_satir_kimligi` `security definer` ve `search_path = ''`.
  Bu kapıdan bir şey sızıyor mu?
- Ters prova dürüst mü? Gerçekten 0104'ü geri alıp mı ölçüyor, yoksa
  ölçtüğünü sandığı şeyi mi ölçüyor?
- `company_zaman_damgasi` BEFORE UPDATE tetiği: `created_at`i koruyor,
  `updated_at`i `now()` yapıyor. Başka bir tetiğin yazdığını eziyor mu?

### 4.2 · **MIYOP-084** — kapı GENİŞLEDİ, doğru mu genişledi

İşletme Ayarları ekranının açılma izni `settings.manage` → **`company.read`**.
Yazma kapısı değişmedi (ekran + depo + veritabanı tetiği).

⚠️ **Sonuç: ekranı artık ALTI rol görüyor** — admin, isletme_muduru,
isletme_sahibi, **izleyici**, **muhasebe**, super_admin.

**Bak:** o ekranda bu altı rolün görmemesi gereken bir şey var mı? Lisans
kartı orada duruyor (plan + bitiş). Veri ihracı orada DEĞİL (`company.manage`,
ayrı rota) — bunu doğrula, iddiaya güvenme.

### 4.3 · **A4** — 851 satır silindi, 21 üretici gitti

İki turda: kiracı tarafı 13 üretici + **"depo boşsa uydur" mekanizmasının
kendisi** (`loadBranchScopedItemsWithDemo` ve ikizi); platform 8 üretici.

**Bak — ve burası bu turun EN RİSKLİ yeri:**
- O yükleyicileri kullanan **21 çağrı yeri** artık `readJson(key, [])`
  okuyor, yani **boş dizi** dönebiliyor. Hangi ekran boş diziyi
  kaldıramıyor? Çöken, `[0]` okuyan, `length` varsayan bir yer var mı?
- `varsayilanLisansPaketleri` / `varsayilanLisansModulleri` **silinmedi,
  adı değişti** — gerekçe "ürün kataloğu, uydurma kayıt değil". Bu gerekçe
  doğru mu, yoksa sayımdan kaçmanın kibar yolu mu?
- Çıcır testi (`sahte-veri-ureticisi.arch.test.ts`) üst sınırı **0** yaptı
  ve sağlama sınaması yeniden yazıldı ("sonuç dolu mu" yerine "araç
  çalışıyor mu"). Bu sağlama gerçekten araç bozulursa kırılıyor mu?

### 4.4 · **PARA BİRİMİ ZİNCİRİ** — modül düzeyinde DEĞİŞKEN DURUM

`billing.ts` içinde `const PARA_BIRIMI = 'TRY'` vardı. Artık:
- `let aktifParaBirimi: string | null` — **modül düzeyinde değişken**
- `paraBirimiAyarla()` besliyor, `paraBirimiDegisinceBildir()` haber veriyor
- `App.tsx` girişte okuyup besliyor, çıkışta `null`a çekiyor
- `isletmeAyarlariniOku()` her okumada besliyor

⚠️ **Bunu ben kendim şüpheli buluyorum ve senden bakmanı istiyorum:**
1. **Testler tek işçide, TEK SÜREÇTE koşuyor** (`vitest.config.ts`,
   `singleThread: true` — tuzak 152). Modül düzeyinde bir değişken,
   test dosyaları arasında SIZAR. `billing.para-birimi.test.ts`
   `afterEach` ile sıfırlıyor ama **başka bir test dosyası** bunu
   bilmiyor. Bir testin yeşilliği başka dosyanın bıraktığı duruma mı
   bağlı?
2. Dinleyici kümesi (`Set<Dinleyici>`) sızdırıyor mu? `App.tsx` aboneliği
   bırakıyor mu?
3. Çıkışta `null`a çekiliyor — ama kullanıcı değişip çıkış YAPILMADAN
   başka kiracıya geçilebilen bir yol var mı?
4. `formatCurrency` artık biçimlendiriciyi **önbellekliyor**. Önbellek
   para birimi değişince düşüyor; başka bir şey değişince düşmesi gereken
   bir durum var mı (dil, yerel ayar)?

### 4.5 · Denetim tarayıcısı **19 → 29**

`denetimIzlenenTablolar()` tek söz dizimi arıyordu; canlıda 29 denetim
tetikleyicisi varken 19 görüyordu. Üç biçim birlikte okunuyor artık ve
sonuç `create table` gövdeleriyle süzülüyor.

**Bak:** süzgeç fazla mı eliyor? Bir denetimli tablo `create table`
dışında bir yolla yaratılmışsa (ör. `create table as`) listeden düşer mi?

### 4.6 · Yedekleme betikleri (yeni)

`araclar/yedek-al.ps1`, `araclar/tam-yedek.ps1`, `docs/YEDEKLEME.md`.

**Bak:** doğrulama adımları gerçekten doğruluyor mu, yoksa "dosya var mı"
mı soruyor? (Tuzak 157 ve 160 tam bu yüzden yazıldı.) `tam.dump`
`pg_restore --list` ile açılıyor — bu yeterli bir kanıt mı?

### 4.7 · Açık bıraktıklarımız (bunları bulgu sayma, ama yorumunu yaz)

- **3.4.7** · işletme geneli KDV oranı hiçbir yerde kullanılmıyor; ekrana
  bunu söyleyen bir cümle kondu, kalıcı karar bekliyor.
- **A2 / MIYOP-008** · şube bağlamı **kapsam dışı** (Emrah, 31.10).
  Kod hâlâ "tercih yoksa ilk şube" diyor ve tek şubede doğru sonucu
  **tesadüfen** veriyor. Bilerek açık.
- **Geri yükleme hiç denenmedi.**
- `timezone`/`language`/`dateFormat`/`theme` hâlâ tarayıcıda — veritabanı
  karşılıkları yok.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.1 · Göç 0104
## 4.2 · MIYOP-084 · genişleyen kapı
## 4.3 · A4 · 851 satır silme — BOŞ DİZİ KALDIRILABİLİYOR MU (en riskli)
<hangi ekran boş listeyi kaldıramıyor? Kanıtı nasıl gösterdin?>
## 4.4 · Para birimi · modül düzeyinde değişken durum
<testler arası sızıntı var mı? Tek başına vs takım içinde koşturup göster.>
## 4.5 · Denetim tarayıcısı 19 → 29
## 4.6 · Yedekleme betiklerinin doğrulaması gerçek mi

## Yeni bulgular
<MIYOP-086'dan devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt. MIYOP-083, -084, -085 bu turda kapandı iddiasındayız.>
```

⚠️ **Son bir şey.** Bu turda bakacağın kod, Claude'un kendi ölçümüyle
**yedi kez** yanıldığı 48 saat içinde yazıldı (tuzaklar 153, 156, 157, 158,
159, 161, 162). Hepsini bir kapı yakaladı — tip denetimi, test, ya da
Emrah'ın kendisi; canlıya hiçbiri gitmedi. **Ama aynı kör noktanın bir
sekizincisi bu kodda duruyor olabilir ve onu ancak dışarıdan biri görür.**
Bir şeyin "ölçüldü" diye yazılmış olması, doğru ölçüldüğü anlamına gelmez —
**ölçümün kendisine de bak.**
