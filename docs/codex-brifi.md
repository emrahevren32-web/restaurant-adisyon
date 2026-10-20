# Codex denetim brifi · MİYOP

> Bu dosya Codex'e yapıştırılmak üzere yazıldı. Her denetim turunda
> güncellenir. Son güncelleme: 20.10.2026, **B başlığı turu**.
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
   kurallar, veri tasarımı kararları ve numaralı tuzak listesi (38–**104**).
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

## 4 · BU TURDA BAKILACAK · **GÜVENLİK DEĞİL, YARIM EKRANLAR**

Üç turdur giriş yüzeyindeydik ve her turda haklı çıktın: MIYOP-044, 046,
048, 051, 052, 053, 054, 055, 056 kapandı; 049/050 bilerek açık ve
gerekçesi yazılı. Bu turda **yön değişiyor.**

Emrah'ın iki cümlesi bu turun çerçevesi:

> *"Yarım ekranlar bariz itibar düşürücü.. katiyyen olmasın."*
> *"Yarım kalan iş kalmayacak, hepsi; sitedeki mock veri kalmayacak,
> mış gibi olmayacağız!"*

İki hafta içinde demo var. Benim sıram: **Profilim → Firma Profili →
Şubeler → Şube Yetkileri → İşletme Ayarları**, sonra mock temizliği.
Senden istediğim, ben yazmadan önce bu altı ekranın **gerçekte ne
yaptığını** ölçmen.

### 4.1 · ALTI EKRAN · her biri için ayrı ayrı

Rotalar: `my-profile`, `company-profile`, `branches`,
`branch-permissions`, `settings` (ve varsa altıncısı — listeyi sen
doğrula; `src/modules/kiraci-ekrani-veri-kaynagi.arch.test.ts` dondurulmuş
listeyi taşıyor).

**Her ekran için şu beş soruyu ayrı ayrı cevapla:**

1. **Hangi veriyi nereden OKUYOR?** `storage.ts` mi, Supabase mi, karışık
   mı? Karışıksa hangi alan nereden?
2. **Kaydet'e basınca ne oluyor?** Hangi fonksiyon çağrılıyor, veri nereye
   yazılıyor, kullanıcıya ne deniyor? **"Kaydedildi" diyip tarayıcıda
   bırakan tam olarak hangi satır?**
3. **Veritabanında karşılığı VAR MI?** Tablo ve kolonlar mevcut mu, yoksa
   bu ekran için yeni göç mü gerekecek? (Bu, işin boyutunu belirliyor.)
4. **Sayfa yenilenince veri kayboluyor mu, kalıyor mu?** Kalıyorsa nerede
   kalıyor — ve o yer başka bir tarayıcıda/cihazda yok, değil mi?
5. **Bu ekran kiracı sınırını koruyor mu?** `storage.ts` üzerinden giden
   bir yazım RLS'i hiç görmüyor; bir kiracının verisi başka kiracıda
   görünebilir mi?

⚠️ **`my-profile` özel:** bugün *"Kullanıcı kaydı bulunamadı"* diyor ve
HİÇ çalışmıyor. Neden? `app_user` sorgusu mu düşüyor, kullanıcı kimliği mi
yanlış eşleşiyor, yoksa ekran localStorage'da olmayan bir kaydı mı arıyor?
**Bu ekrana ilk ben gireceğim; kök nedeni bilmek istiyorum.**

### 4.2 · MOCK VE "MIŞ GİBİ" TARAMASI · asıl istediğim bu

36 dosyanın adı `.mock.ts` ve bir mimari test açık kiracı rotalarından
erişilemediklerini kanıtlıyor. **Ama benim taramam AD DESENİNE bakıyor** ve
`storage.ts` bize şunu öğretti: asıl tehlike **adı mock olmayanlar**
(tuzak 86).

**Soru:** depoda uydurma/sahte veri üreten ya da gerçekmiş gibi gösteren
**başka ne var?** Özellikle ara:

- Sabit (hardcoded) diziler ve nesneler: örnek müşteri, örnek ürün, örnek
  sipariş, örnek kullanıcı — ekranda gerçek veri yerine geçenler.
- `Math.random()`, `faker`, `örnek`, `demo`, `test`, `sample`, `dummy`,
  `placeholder` gibi adlar taşıyan veri üreticileri.
- **Hesaplanmış gibi görünen ama sabit olan sayılar** — bir göstergenin
  yanında duran `%12` gibi.
- Boş sonuç geldiğinde **uydurma bir şey gösteren** ekranlar: "veri yok"
  demek yerine örnek satır basan yerler.
- `foundationScope: 'frozen'` ile kapatılmış modüllerin rotalarının
  GERÇEKTEN kesildiği yer — bir tanesi bile render ediliyorsa söyle.

Her bulgu için: **dosya + satır**, ne gösteriyor, kullanıcı bunu nerede
görebilir, ve **silinebilir mi yoksa gerçek veriye mi bağlanmalı**.

### 4.3 · MIYOP-008 ve MIYOP-010 · demo öncesi listede

Bu ikisini önceki turda kabul kriterleriyle genişletmiştin; şimdi
yazacağım. **Eklemen gereken bir şey kaldı mı?**

- **MIYOP-008** · başlıkta seçilen şube gerçek sorgulara aktarılmıyor.
  Senin notun: `warehouse.context.ts:131` geçersiz tercihte merkezi
  seçiyor. **Soru:** şube seçimi kaç ayrı yerden okunuyor ve hepsi aynı
  kaynağa mı bakıyor? Yazım yolunda `branch_id` nereden geliyor?
- **MIYOP-010** · etiket ekranında ürünler arası veri karışması.
  Senin notun: `Etiketler.tsx:163` ürünü hemen değiştiriyor, yedi ayrıntı
  isteğinden biri düşerse öncekinin verisi kalıyor. **Soru:** aynı desen
  başka ekranlarda da var mı? (Seçim değişince eski verinin kalması.)

### 4.4 · Hâlâ açık, tekrar raporlamana gerek yok

**MIYOP-003** · **004** · **005** · **006** · **017** · **018** ·
**040** · **043** (0091 bekliyor) · **045** · **047** · **049** · **050** ·
bayat prova listesi (11) · kör prova listesi (13).

⚠️ Bu turda **giriş yüzeyine bakma** — oraya yeni kod gelmedi ve
dağıtımdan sonra ayrıca denetleteceğim.

## 5 · ÇIKTI BİÇİMİ

```
## Özet
<üç cümle: durum ne, en kritik ne, bir önceki denetime göre ne değişti>

## 4.1 · Altı ekran
<her ekran için beş sorunun cevabı; tablo hâlinde. "Kaydedildi" diyip
 tarayıcıda bırakan SATIR numarasıyla>

## 4.2 · Mock ve "mış gibi" taraması (EN ÖNEMLİ BÖLÜM)
<her bulgu: dosya + satır, ne gösteriyor, kullanıcı nerede görür,
 SİLİNEBİLİR mi yoksa GERÇEK VERİYE BAĞLANMALI mı>

## 4.3 · MIYOP-008 / MIYOP-010
<eklenecek kabul kriterleri>

## Yeni bulgular
<MIYOP-031'den devam numaralandır>

## Kapandığını doğruladığım eski bulgular
<numara + kanıt>
```
