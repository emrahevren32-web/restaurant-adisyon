# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: **04.11.2026 · göç 0105 + MIYOP-086 onarımı
> + iki çıcır + geri yükleme provası**.
> Dal: `production-foundation` · son commit: **`1919609`** · 1706 sınama yeşil
> Canlı: **v0.5.3** (`index-KITpW4gQ.js`) · veritabanı **göç 0105**
>
> ⚠️ **Bir önceki turun yedi bulgusunun yedisi de kapandı** (MIYOP-086…092).
> Bu tur, o kapatmaların KENDİSİNİ ve üstüne gelen yeni işi denetliyor.
> Kapatan kişi ile kapatmayı doğrulayan kişi aynı olmamalı — bu turun asıl
> sebebi bu.

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi
   (38–**176**) ve kontrol listesi (1–**99**).
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
   ⚠️ **163–168b de aynı aileden ve hepsi 01.11'de eklendi:**
   · 163 beklenen değeri **birikimi** hesaba katmadan yazdı (7 dedi, 4 doğruydu)
   · 163b tek süreçte paylaşılan durumun bedelini YAZDI, sonra kendisi üretti
   · 164 **verilmiş bir kararı** yeniden "yapılacak iş" diye önerdi
   · 165 depo kopyası `src`in **%11'iydi**; orada "bulunamadı" ölçüm değildi
   · 166 bekçi beklediği yer tutucuyu tanımıyordu (`BURAYA` ≠ `buraya`)
   · 167 `.gitignore`'a yazmak takibi durdurmaz — deponun %54'ü çöptü
   · 168 ekran, hangi ekran olduğu konusunda yalan söylüyordu
   · **168b** bir fonksiyonu **adıyla** kullandı, gövdesini okumadan —
     yazdığı sınama ölçmek istediğinin tersini ölçtü
   ⚠️ **Ve 02.11'de üç tane daha:**
   · **174** append-only bir deftere *"hiç yok"* diye sordu; o soru gerçek
     bir veritabanında asla doğrulanamaz
   · **175** bir çıcırı **ada** bağladı; iki yeniden adlandırma onu
     delince sayım 4 yerine **0** gösterdi
   · **176** *"daha zayıf, patlayabilir"* dedi; ölçüm gösterdi ki
     **patlamıyor, sessizce kaybediyor**
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

Önceki turda sen yedi bulgu getirdin, yedisi de kapandı. **Bu tur
kapatmaları denetliyor.** Sırayla:

### 4.1 · Göç **0105** — işletme KDV oranı ürün kartına geçiyor (CANLIDA)

`db/migrations/0105_urun_kdv_isletmeden.sql` · `db/prova/prova-0105.sql`
(13 ölçüm) · `db/prova/prova-0105-ters.sql` (4 ölçüm)

`stock_item.vat_rate` boş bırakılırsa `tenant_settings.vat_rate`
kopyalanıyor. BEFORE INSERT, UPDATE kapsam dışı, `security definer`.

**Bak:**
- ⚠️ **`security definer` + `search_path = ''` güvenli mi?** Fonksiyon
  `public.tenant_settings`i `new.tenant_id` ile süzüyor. Başka bir kiracının
  satırını okumanın bir yolu var mı? `new.tenant_id`ye güvenmek doğru mu —
  `stock_item`in kendi RLS'i onu gerçekten sınırlıyor mu, yoksa
  `service_role` ile yazarken sınırsız mı?
- Neden `security definer` seçildiğinin gerekçesi göç başlığında yazılı
  (izinsiz rolde sessizce boş kalmasın). **Gerekçe doğru mu, yoksa daha dar
  bir çözüm mü vardı** (ör. `tenant_settings`e okuma politikası)?
- `stock_item` üzerinde başka BEFORE tetikleri var
  (`izin_stock_item`, `trg_lisans_kilidi_stock_item`,
  `stock_item_alerjen_damgasi`). Sıra alfabetik. **Bu sıra bir sorun
  üretiyor mu?** Lisans kilidi reddettiğinde KDV kopyalanmış olur mu ve
  bunun bir önemi var mı?
- Prova **13 ölçüm** diyor, dördü olumsuz kontrol. **Olumsuz kontroller
  gerçekten olumsuz mu** — tetik kaldırılınca hepsi kırılıyor mu?

### 4.2 · **MIYOP-086 onarımı** — oturum sürümü sayacı (CANLIDA) · EN RİSKLİ

`src/billing.ts` (`paraBirimiOturumuTazele`, `paraBirimiOturumSurumu`,
`paraBirimiAyarla(kod, surum?)`) · `src/workspace/isletme-ayarlari.repository.ts`
· `src/App.tsx`

Senin bulduğun kusur: A çıkıp B girdikten sonra A'nın iptal edilmiş okuması
B'nin para birimini eziyordu. Çözüm bir sayaç: kullanıcı değişince artıyor,
okuma kendi başlama sürümünü taşıyor, sürümü eskiyen cevap atılıyor.

**Bak — ve bu turun en riskli yeri burası:**
- ⚠️ **Ters yönde bir hata üretildi mi?** Yani sayaç yüzünden MEŞRU bir
  cevabın atıldığı bir yol var mı? O zaman para birimi hiç yüklenmez ve
  ekran sessizce ₺'de kalır — eski hatanın aynadaki görüntüsü.
- `paraBirimiOturumuTazele()` `App.tsx`te `[currentUser]` etkisinin İLK
  satırında. `currentUser` kimliği ne sıklıkla değişiyor? (Ben ölçtüm:
  yalnız giriş, izin tamamlama ve profil kaydında; profil kaydı değişiklik
  yoksa `onceki`yi döndürüyor. **Ama benim ölçümüme güvenme.**)
- React 18 `StrictMode` etkiyi iki kez koşturuyor mu, koşturuyorsa ilk
  okumanın cevabı atılıp ikincisi mi dolduruyor?
- Çıkış sıfırlaması **sürümsüz** çağrılıyor (`paraBirimiAyarla(null)`).
  Sürümsüz çağrı her zaman geçerli. **Bu kapı fazla açık mı** — başka bir
  yerden sürümsüz çağrı gelirse bayat değer girebilir mi?
- `isletmeAyarlariniOku` sürümü `await`ten ÖNCE alıyor. Başka bir okuma
  yolu (kaydet-sonra-oku) sürümü yanlış anda alıyor olabilir mi?

### 4.3 · **İki çıcırın kendisi** — ölçüm araçları ölçülüyor mu

`src/modules/sahte-veri-ureticisi.arch.test.ts` ·
`src/navigation/menusuz-rota-etiketi.arch.test.ts`

Senin MIYOP-089 ve -091 bulguların kapandı. Üstüne 02.11'de **üçüncü bir
delik** bulundu (tuzak 175): *"anahtar yoksa demo üret"* çıcırı
`createDemo*` ADINA bağlıydı; iki fonksiyon yeniden adlandırılınca sayım
**4 yerine 0** gösteriyordu. Desen artık ada değil **mekanizmaya** bakıyor,
üst sınır **4**.

**Bak:**
- Yeni desen `getItem(...) === null ? <dal> :` okuyup boş liste/nesne/null
  dışındaki her cevabı sayıyor. **Fazla mı eliyor, az mı?** Mekanizmanın
  bu dosyada YAKALANMAYAN başka bir yazımı var mı (ör. `??`, `if` ile
  yazılmış hâli, `readJson(k, createX())`)?
- Üst sınır 4'ün gerekçesi: o dördü silmek beş dondurulmuş platform
  ekranının `import`unu kırardı ve ölçüldü ki o ekranların hiçbiri
  açılamıyor (`PLATFORM_HAZIR_ROTALAR` dört rota içeriyor,
  `SaasManagementCenter`ı açan rotaların hiçbiri orada değil).
  **Bu ölçümü doğrula.** Gerçekten ulaşılamıyorlar mı?
- `menusuz-rota-etiketi.arch.test.ts` artık yardımcının GÖVDESİNİ kesip
  `setActiveNavKey(hedef)` arıyor. **Bu kesme sağlam mı** — gövde biçimi
  değişirse (ör. tek satıra inerse) sınama sessizce hiçbir şey ölçmez hâle
  gelir mi?

### 4.4 · **Lisans kataloğu** — senin düzelttiğin iddia

Sen 01.11'de şunu söylemiştin: koddaki `defaultPackageSpecs`
*"MİYOP'un gerçekten sattığı planlar"* değil. 02.11'de ölçüldü ve
haklıydın: kodda `maxTables` (masa sayısı), `adisyon`/`qr-menu` modülleri,
999–4999 ₺; canlı `0042`de iki paket, fiyat 0, sınır `null`, endüstriyel
mutfak. **Endüstriyel mutfakta masa yok.**

**Bak:** bu borcun kapanma yolu ne olmalı — silmek mi, veritabanından
beslemek mi? Ekran açılmadan önce yapılacaklar listesi ne?

### 4.5 · **Yedekleme ve geri yükleme** — ikisi de yeniden yazıldı

`araclar/yedek-al.ps1` (doğrulama) · `araclar/geri-yukle-provasi.ps1`
(YENİ) · `docs/YEDEKLEME.md` §6.2, §6.2.1, §6.2.2, §6.2.3

Senin MIYOP-087 ve -088 bulguların kapandı. Üstüne geri yükleme **ilk kez
gerçekten koşturuldu** ve iki şey ölçüldü (tuzak 176):
- `pg_restore` + `tam.dump` → **çıkış kodu 1**, sonuç **kusursuz**
- `psql` + `sema.sql` → `veri.sql` → **çıkış kodu 0**, **kiracı 0,
  denetim 0** (11 FK hatası atlanmış)

Sonra gerçek döküm Emrah'ın PostgreSQL 18'ine yüklendi: 66 tablo ·
146 fonksiyon · 203 tetik · **78 RLS kuralı** · 8 kiracı · 123 denetim
kaydı. (146/203, dökümün 0105 öncesi olmasından; 78'e ilk koşuda 76'dan
çıkıldı — `supabase_auth_admin` rolü yerelde yoktu.)

**Bak:**
- ⚠️ `geri-yukle-provasi.ps1` **rolleri açıyor** (`anon`, `authenticated`,
  `service_role`, `supabase_auth_admin`). Bu, prova ortamını gerçeğe
  benzetmek için — **yoksa provayı kolaylaştırıp gerçeği gizliyor mu?**
  Supabase'de bu roller gerçekten bu adlarla ve bu özelliklerle mi var?
- Betik **çıkış koduna bakmıyor**, sayılara bakıyor. **Sayım sorgusu
  yeterli mi?** Hangi tablo sayılmıyor ve sayılmadığı için bir kayıp
  görünmez kalır?
- `kiracı = 0` tek kırmızı ölçüt. **Daha iyi bir ölçüt var mı?**
- `yedek-al.ps1` artık arşivi baştan sona SQL'e çeviriyor. Büyük bir
  veritabanında bu ne kadar sürer, bir sınır koymalı mı?

### 4.6 · **MIYOP-090 onarımı** — prova iddiaları zaman penceresinde

`db/prova/prova-0104.sql` · `db/prova/prova-0104-ters.sql`

Senin bulgun kapandı: her iki prova başta `max(id)` alıyor, defter
iddiaları yalnız ondan sonraki satırlara bakıyor.

**Bak:** su seviyesi iddiayı **etkisizleştirmiş** olabilir mi? (İki olumsuz
kontrol koşturuldu: 0104 geri alınınca kırmızı; yapı kontrolü geçsin diye
`denetim_satir_kimligi` `null` döndürülünce de kırmızı. **Bunları
doğrula.**)

### 4.7 · Açık bıraktıklarımız (bulgu sayma, yorumunu yaz)

- **A5 · Şahit Numune** boş bir kiracıda canlı olarak **henüz
  doğrulanmadı**. 28.10'da orada çökmüştü.
- **A5'in sayfalama borcu** · demo sonrasına karar verildi.
- **A2 / MIYOP-008 · şube** kapsam dışı (Emrah, 31.10).
- **Davet e-postası** denemesi yapılmadı. Ölçüldü: uygulamada davet
  bağlantısını ekranda gösteren düğme **yok**.
- Dökümün **gerçek bir Supabase projesine** yüklenmesi denenmedi.
- `timezone`/`language`/`dateFormat`/`theme` hâlâ tarayıcıda.
- `@media 980px` altındaki üç `.side-nav` bloğunun `position/transform/width`
  kuralları hiçbir genişlikte uygulanmıyor (ölü CSS) · demo sonrası.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, önceki tura göre ne değişti>

## 4.1 · Göç 0105 · security definer gerçekten dar mı
## 4.2 · MIYOP-086 onarımı · TERS yönde hata üretildi mi (en riskli)
## 4.3 · İki çıcırın kendisi · ölçüm araçları ölçülüyor mu
## 4.4 · Lisans kataloğu · kapanma yolu ne olmalı
## 4.5 · Yedekleme/geri yükleme · prova gerçeği gizliyor mu
## 4.6 · MIYOP-090 onarımı · su seviyesi iddiayı etkisizleştirdi mi

## Yeni bulgular
<MIYOP-093'ten devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<MIYOP-086…092 · numara + kanıt>
```

⚠️ **Son bir şey.** Geçen turda en değerli çıktın bulduğun hatalar değil,
**düzelttiğin üç cümleydi** — "tek işçi, modüller paylaşılır" fazla
genişti, "21 çağrı yeri" 32'ydi, "gerçekten sattığı planlar" tutmuyordu.
Üçü de ölçmeden yazılmış cümlelerdi. **Bu turda da cümlelere bak:** bu
brifte ve kodun yorumlarında ölçülmeden yazılmış bir iddia varsa, onu
bulman bir kusur bulmak kadar değerli.
