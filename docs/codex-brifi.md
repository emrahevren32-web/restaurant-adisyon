# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: 18.10.2026, göç **0089** yazıldıktan sonra.
> Dal: `production-foundation`

---

Merhaba. MİYOP adlı bir endüstriyel mutfak ERP'sini denetleyeceksin.

**Depo:** `C:\Users\90544\Documents\restaurant-adisyon`

## 1 · ÖNCE BUNLARI OKU

Bu projede alışılmadık görünen çoğu kararın yazılı bir gerekçesi vardır —
ve o gerekçe genellikle kararın alındığı dosyanın başlık yorumundadır.
Dışarıdan gelen biri bu gerekçeyi görmeden "hata" diyebilir. Bir şeyi
hata saymadan önce gerekçesini ara. Okuma sırası:

1. `docs/kararlar/kararlar-ve-tuzaklar.md` — **en önemlisi.** Değişmez
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**95**).
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

**Önceki turun sonucu: haklıydın, iki akışı da ben kırmıştım.**
MIYOP-038 ve MIYOP-039'u yerel PostgreSQL'de ürettim, **0089** ile
onardım, ve 0089'u çıkarıp provanın kırmızıya döndüğünü doğruladım.
MIYOP-041 ve MIYOP-042 de kabul edildi ve işlendi. MIYOP-043 sıraya
alındı ve **sıradaki işim o.**

Bu turda tek bir soru diğerlerinden önemli: **0089 güvenlik sınırını
gevşetti ve ben bunu kendi kendime onayladım. İkinci bir göz istiyorum.**

### 4.1 · 0089'UN BEDELİ · bu turun ana sorusu

`db/migrations/0089_sistem_yazimi_kapidan_gecsin.sql`

**Ne yaptım:** on yazma kapısı artık `app.bakim_baglami()` yerine
`app.kapi_disi_baglam()` soruyor:

```sql
select current_user not in ('anon', 'authenticated');
```

Yani: yazım PostgREST'ten **doğrudan** geliyorsa kapı sorulur; bizim bir
`security definer` rutinimizin **içinden** geliyorsa kapı sorulmaz ve
yetki o rutinin kendi kontrolüne kalır.

**Bedeli:** `authenticated`a açık, kapılı bir tabloya yazan **11**
`security definer` fonksiyon artık kapının dışında. Göç bu listeyi
adlarıyla donduruyor (12.'si çıkarsa göç patlar):

`app.basvuruyu_onayla` · `app.lisans_olayi_yaz` · `app.lisansi_uzat` ·
`app.personel_hesabi_ac` · `app.personel_sifresi_sifirlandi` ·
`app.sifremi_belirledim` · `public.alerjen_beyani_yaz` ·
`public.portal_siparis_guncelle` · `public.portal_siparis_ver` ·
`public.set_negative_stock_policy` · `public.set_primary_role`

**Senden istediğim — fonksiyon fonksiyon:**

1. **Her biri gerçekten kendi yetki kontrolünü yapıyor mu?** Hangi satırda?
   Kontrol, çağıranın kim olduğuna mı yoksa gönderdiği parametreye mi
   bakıyor? (İkincisi ise parametre değiştirilerek aşılabilir.)
2. **Kiracı sınırı korunuyor mu?** `tenant_id` parametreden mi geliyor,
   oturumdan mı? Parametreden geliyorsa başka kiracının kimliği
   gönderilebilir mi?
3. **Kapı dışına çıkmakla NE kazanıldı, ne kaybedildi?** Bu 11'den
   hangisi kapının içinde kalabilirdi ve ben gereksiz yere mi dışarı
   aldım? (Hepsini tek kuralla dışarı aldım; daha dar bir kural mümkün
   müydü?)
4. **`current_user` güvenilir bir ayrım mı?** PostgREST'ten gelen bir
   isteğin `current_user`ı `authenticated` olmadığı bir yol var mı?
   Edge Function'lar kullanıcının JWT'sini taşıyıp `service_role` ile
   bağlanıyorsa, o yazımlar da kapı dışında kalır — bu kabul edilebilir mi?

### 4.2 · Üçüncü bir kırık akış var mı

0085 iki akış kırdı (sen buldun), 0088 iki akış daha kırdı (sen buldun).
**Üçüncü turda da bulabileceğini düşünüyorum.**

0089'dan SONRA, kapılı 27 tabloya yazan her yolu tekrar gözden geçir:
ekran, servis, RPC, Edge Function, tetik zinciri. Özellikle:

- Yeni kiracı açılışı: 0035, 0039, 0061, 0079, `app.onay_zincirini_kur`
- İçe aktarma: `catalog-import`, `supplier-import`, `excel-import`
- Tetik zincirleri: bir tabloya yazım başka bir kapılı tabloyu tetikliyor
  mu, ve o ikinci kapı aynı izin kümesini kabul ediyor mu?

### 4.3 · MIYOP-043 · ben başlamadan önce kapsamını netleştir

Sıradaki işim bu. Başlamadan önce şunu bilmek istiyorum:

- Giriş adresi çözümünün **başka hangi çağıranları** var? (ekran, test,
  Edge Function) Sunucu tarafına taşırsam ne kırılır?
- `anon`a açık **başka hangi RPC'ler** kullanıcı varlığını ya da gerçek
  e-postayı ele veriyor? (Aynı sınıf başka açık var mı?)
- Önerdiğin çözüm giriş akışını nasıl değiştirir — kullanıcı adı +
  firma kodu ile giriş çalışmaya devam etmeli.

### 4.4 · Göçlerin tekrar çalıştırılabilirliği · yeni, benim bulgum

Teslim kontrol listem 2026 boyunca *"göçü İKİ KEZ çalıştır"* diyordu ama
bunu hiç ölçmemiştim. 0089 canlıda tam bu yüzden durdu: ikinci koşuda
kendi başarısını hata sandı. Ölçtüm: **90 göçün 9'u daha ikinci koşuda
patlıyor** — 0004, 0033, 0034, 0038, 0042, 0043, 0051, 0054, 0082.
(0084 ve 0089 onarıldı.)

**Soru:** bu 9'dan hangisi gerçek bir risk? Yani canlıda yarıda kalmış
bir göçü tekrar denemek zorunda kalsaydık hangisi **veriyi bozardı**,
hangisi yalnızca hata verip dururdu? Öncelik sırası ver.

### 4.5 · Kapanan bulguların doğrulaması

Kapandığını iddia ettiklerim — kanıtla çürütmeni isterim:
**MIYOP-038** · **MIYOP-039** · **MIYOP-041** · **MIYOP-035** ·
**MIYOP-001** (27 tablo + kapısız yüzey = 0).

Davranış provaları: `db/prova/prova-0088.sql` (42 doğrulama),
`db/prova/prova-0089.sql` (17 doğrulama). Koşturmak için:
`bash db/prova/kur.sh` sonra `bash db/prova/hepsini-kosturt.sh`.

### 4.6 · Hâlâ açık, tekrar raporlamana gerek yok

Kapsamları değiştiyse söyle: **MIYOP-003** · **MIYOP-004** ·
**MIYOP-005** · **MIYOP-006** · **MIYOP-017** · **MIYOP-018** ·
**MIYOP-040** · ve bayat prova listesi (11 dosya, sen teşhis ettin).

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.1 · 0089'un bedeli (EN ÖNEMLİ BÖLÜM)
<11 fonksiyonun her biri için: yetki kontrolü VAR/YOK + satır,
 kiracı sınırı KORUNUYOR/KORUNMUYOR, kapı dışına çıkması GEREKLİ miydi>

## 4.2 · Üçüncü kırık akış
<her akış için: tablo, yazan yol, rol, gereken izin, sahip mi,
 sonuç: ÇALIŞIR / KIRIK / DOĞRULANMADI>

## 4.4 · Tekrar çalıştırılamayan 9 göç
<her biri: VERİYİ BOZAR / yalnizca HATA VERİR + öncelik>

## Yeni bulgular
<MIYOP-031'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```
