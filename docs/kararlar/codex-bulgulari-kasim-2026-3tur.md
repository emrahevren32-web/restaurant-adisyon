# Codex 3. tur bulguları — ne ölçüldü, ne onarıldı
**09.11.2026 · gece turu**

Codex'in 3. tur raporu **8 bulgu** getirdi (MIYOP-100…107): 3 P1, 5 P2.
Bu dosya her birinin **ne olduğunu, nasıl ölçüldüğünü ve neyle
kapandığını** yazıyor. Kapanmış bir bulgu, kanıtı yazılmadan kapanmış
sayılmaz.

⚠️ **ÖLÇÜLMEMİŞ HİÇBİR ŞEY "ONARILDI" YAZMIYOR.** Aşağıdaki her satırın
ya bir prova dosyası ya bir ölçüm çıktısı ya da bir sınama karşılığı var.
Son sütun "kanıt nerede" sorusunun cevabıdır.

---

## Özet

| Bulgu | Önem | Durum | Kanıt |
|---|---|---|---|
| MIYOP-100 · şahit numuneyi yetkisiz kullanıcı API'den okuyabiliyordu | P1 | ✅ kapandı | göç 0107 · `prova-0107.sql` + ters prova |
| MIYOP-101 · istemcinin `occurred_at`ı saklama kuralını etkisiz bırakıyordu | P1 | ✅ kapandı | göç 0109 · `prova-0109.sql` + ters prova |
| MIYOP-102 · spam kapıları eşzamanlı yazımla aşılabiliyordu | P1 | ✅ kapandı | göç 0110 · `prova-0110.sql` + ters prova + iki oturumlu ölçüm |
| MIYOP-103 · kaydedilen firma adı/logosu kabuğa ulaşmıyordu | P2 | ✅ kapandı | `src/companies/firma-vitrini.ts` + `firma-vitrini.test.ts` |
| MIYOP-104 · bayat cevap okunmuş bildirimi yeniden okunmamış yapıyordu | P2 | ✅ kapandı | `src/notifications/tazeleme-sirasi.ts` + testi |
| MIYOP-105 · metin eşikleri ekranla veritabanında farklıydı | P2 | ✅ kapandı | göç 0111 · `prova-0111.sql` + mimari test |
| MIYOP-106 · büyük harfli uzantılı e-posta ekranda reddediliyordu | P2 | ✅ kapandı | `geri-arama.test.ts` (üç yeni sınama) |
| MIYOP-107 · kaldırılan duyuruların CSS'i kalmıştı | P2 | ✅ kapandı | `giris-vitrini-dogru-soyler.arch.test.ts` (yeni blok) |

**Prova durumu (temiz veritabanı, 09.11.2026):** 113 göç uygulandı,
**63 prova · 63 yeşil · 0 kırmızı** (`db/prova/son-kosu.json`).

⚠️ **GÖÇ 0112 BİR CODEX BULGUSU DEĞİL.** 0109'u yazarken aynı desenin
komşu kolonda da durduğunu gördüm: `app.numune_turet()` imzanın "KİM"
tarafını damgalıyor (`taken_by`), "NE ZAMAN" tarafını (`taken_at`)
istemciye bırakıyordu. Kolonun `default now()` değeri vardı ama
varsayılan yalnız istemci bir şey göndermediğinde devreye girer.
⚠️ **0109'unki kadar ciddi DEĞİL ve öyleymiş gibi yazmıyorum:**
`taken_at` hiçbir kuralın girdisi değil (ölçüldü — `keep_until`
partinin SKT'sinden geliyor), yani kaydırılması bir kapı AÇMIYOR.
Bozduğu şey defterin kendi doğruluğu. Ekran bu alanı hiç göndermiyor,
yani akış kırılmıyor. Kanıt: `prova-0112.sql` (11 iddia).

⚠️ **Bu turda `tsc` ve `npm test` KOŞTURULAMADI** (çalışma ortamında
`node_modules` yok). TypeScript tarafındaki dört değişiklik (MIYOP-103,
104, 106 ve mimari testler) **yalnız sözdizimi** açısından denetlendi.
Sabah ilk iş: `npm run typecheck` + `npm test`. Bu, kontrol listesi
141'in ("testler yeşil ile kod derleniyor ayrı iki iddiadır") gereği.

---

## MIYOP-101 · P1 · Olay zamanı istemciden geliyordu

**Neydi.** 0094 açılmış numunenin saklama sonunu şöyle kısaltıyordu:

    v_an := coalesce(new.occurred_at, now());
    keep_until := least(s.keep_until, (v_an::date + v_acik));

`occurred_at` istemciden yazılabilen bir kolon. Gelecek bir tarih
gönderen istemci için `v_an::date + v_acik` partinin SKT'sinin ötesine
düşüyor, `least()` eski değeri seçiyor ve **saklama sonu hiç
kısalmıyordu**: açılmış numune mühürlüymüş gibi davranıyordu.

**Nasıl ölçüldü.** İlk ölçüm **yanıltıcıydı** (tuzak 193): fikstürde
ürün kartına açık raf ömrü yazılmamıştı, `keep_until` gelecek tarih
yüzünden değil kuralın hiç çalışmaması yüzünden sabit kalmıştı.
Kontrollü ölçüm (açık raf ömrü = 2 gün, iki ayrı numune, iki ayrı parti):

    A · occurred_at gönderilmedi → keep_until bugün+2   (kısaldı)
    B · occurred_at = +30 gün    → keep_until SKT       (KISALMADI)

18 gün fazla "mühürlü" sayılan bir numune.

**Onarım.** Göç 0109: `new.occurred_at := now()` — koşulsuz sunucu
damgası (0081/0087'nin "imza istemciden gelmez" kuralı bu kolona da).
`coalesce` yetmezdi: kolon NOT NULL olduğu için istemci bir değer
gönderdiğinde `coalesce` **onu seçiyordu**.

**Kırılan ekran akışı yok:** `witness-sample.repository.ts > olayYaz()`
`occurred_at` **göndermiyor** (ölçüldü, ve bu artık mimari testte
donduruldu).

**Kanıt.** `prova-0109.sql` (12 iddia: fikstür sağlaması, normal yol,
gelecek tarih, **geçmiş tarih**, olayın kendi damgası, gövde ölçümleri),
`prova-0109-ters.sql` (damga kaldırılınca kusur geri geliyor).

---

## MIYOP-102 · P1 · Spam kapıları eşzamanlı yazımla aşılabiliyordu

**Neydi.** Geri arama formunun iki sınırı da "oku, sonra yaz"
desenindeydi. PostgreSQL'in öntanımlı yalıtımı READ COMMITTED: eşzamanlı
iki çağrı birbirinin henüz COMMIT edilmemiş satırını görmez.

**Nasıl ölçüldü.** Önce **20 paralel gerçek çağrı** denendi: 1 yazım,
19 ret. ⚠️ Yarış hiç oluşmadı — süreç başlatma gecikmesi çağrıları
sıraya dizdi. "Paralel koşturdum, geçti" demek yanlış yeşil olurdu
(tuzak 196). Sonra fonksiyonun kendi sırası iki oturumda araklandı:

    A: begin → kapı okuması 0 → (bekle) → insert → commit
    B:        → kapı okuması 0 → (bekle) → insert → commit
    sonuç: 2 NEW satır (aynı telefon)

**Onarım (iki kat, birbirinden bağımsız).** Göç 0110:
1. `pg_advisory_xact_lock(110, hashtext(telefon))` — asıl kapı. Aynı
   numaradan gelen ikinci çağrı birincisi COMMIT edene kadar bekler.
   ⚠️ 24 saat / 3 talep sınırı için **zorunlu**: bir sayma kuralını
   hiçbir tekillik indeksi ifade edemez.
2. `unique (phone) where status = 'NEW'` kısmi indeksi — kilidi almayan
   bir yol açılırsa fiziksel emniyet.
3. Yazma döngüsü artık **hangi kısıtın çakıştığını ayırt ediyor**: yoksa
   kullanıcı "Talep numarası üretilemedi" gibi yanlış bir sebep görürdü.

**Onarımdan sonraki ölçüm.** Gerçek fonksiyonla iki oturum: B kilitte
**bekledi**, sonra MI409 aldı → 1 NEW satır. Kilidi atlayan ham yazım
indekse çarptı.

**Var olan kayıtlar.** Göç hiçbir kaydı silmiyor: aynı numaranın en eski
açık talebi NEW kalıyor, sonrakiler CLOSED'a çekiliyor ve notuna sebebi
yazılıyor. Prova veritabanında 1 kayıt kapatıldı (benim yarış ölçümünün
bıraktığı satır) — yani bu yol da ölçüldü.

**Kanıt.** `prova-0110.sql` (11 iddia), `prova-0110-ters.sql`,
`src/onboarding/geri-arama-kapisi.arch.test.ts` (9 yeni iddia).

---

## MIYOP-105 · P2 · Ekran ile veritabanı aynı şeyi istemiyordu

Ekran: numune kodu ≥ 2, gerekçe ≥ 3, açılış sonucu ≥ 3 karakter — ve bu
kuralları **gerçekten uyguluyor** (`SahitNumune.tsx` 224, 292-293).
Veritabanı: yalnız "boş olmasın". Yani API'den yazan biri gerekçe yerine
`.` koyup geçebiliyordu.

Göç 0111 üç kısıtı ekranın eşiğine getirdi. Muafiyetler korundu:
`ALINDI` gerekçe istemiyor, `IMHA` sonuç istemiyor.

⚠️ Göç **önce eski kayıtları ölçüyor**: ihlal varsa kısıt eklenmiyor ve
sayısını söylüyor (0100'ün deseni). Prova veritabanında ihlal yoktu.

⚠️ Mimari test eşik sayısını **elle yazmıyor**: ekranın kendi
fonksiyonundan davranışla ölçüyor (`numuneKoduYeterliMi`,
`gerekceYeterliMi`) ve göçteki kısıt tanımıyla karşılaştırıyor. Biri
değişip diğeri kalırsa test kırmızı yanar.

**Kanıt.** `prova-0111.sql` (7 iddia, hepsi canlı yazımla),
`src/quality/numune-kapisi.arch.test.ts` (yeni blok).

---

## MIYOP-103 · P2 · Kaydedilen firma adı/logosu kabuğa ulaşmıyordu

"Firma Profili" ekranı adı ve logoyu **veritabanına** yazıyor; kabuk
(`App.tsx > workspaceChrome`) **tarayıcı deposundan** okuyordu. Sonuç:
kullanıcı kaydediyor, kenar çubuğu/üst bant/sekme başlığı eski adı
gösteriyor. En kötü hata sınıfı: **iş yapıldı, ekran yapılmamış dedi.**

Onarım: `src/companies/firma-vitrini.ts` — kabuk adı ve logoyu
defterden okuyor; tarayıcı deposu yalnız defter boşken geriye düşülen
yer. Profil ekranı kaydettikten sonra bir tarayıcı olayı yayımlıyor
(zilin yıllardır kullandığı desen), kabuk dinleyip yeniden okuyor.

⚠️ Araya prop yolu kurmak üç dosyayı değiştirmek olurdu
(`BusinessWorkspaceRouteHost` arada).

⚠️ Okuma, MIYOP-104'ün dersiyle yazıldı: `iptal` bayrağı olmadan havada
kalmış eski bir okuma yeni kullanıcının vitrinini ezebilirdi.

---

## MIYOP-104 · P2 · Bayat cevap okunan bildirimi yeniden okunmamış yapıyordu

Zil dört tetikleyiciyle tazeliyor (dakikalık yoklama, sekmeye dönüş,
panel açılışı, "okundu" olayı) ve cevaplar gönderildikleri sırayla
dönmek zorunda değil. Eski bir cevap sonradan yazıldığında okunmuş
bildirim yeniden okunmamış görünüyordu — **rozet ve sekme başlığı
dahil**, yani dün gece eklenen `(1) EVREN360` sayacı da etkileniyordu.

Onarım: `src/notifications/tazeleme-sirasi.ts` — **son istek kazanır**.
Kural saf fonksiyon olarak yazıldı ki ölçülebilsin (5 sınama).

⚠️ `AbortController` değil, bilerek: sorun ağ değil **yazma sırası**;
üç kaynak `Promise.all` ile okunuyor ve iptal edilse bile yarısı dönmüş
olabilir.

---

## MIYOP-106 · P2 · Büyük harfli uzantı ekranda reddediliyordu

`geri-arama.service.ts`: `/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/` — adres
küçültülmeden sınanıyordu. Sunucu (0106) adresi **önce `lower()` ile
küçültüp** bakıyor. Yani `audit@example.COM` ekranda reddediliyor,
sunucuda kabul ediliyordu: ekran sunucudan **katı ve yanlış taraftaydı**.

Onarım: `.test(eposta.toLowerCase())`.
⚠️ `toLocaleLowerCase()` DEĞİL: Türkçe yerel ayarda `.INFO` → `.ınfo`
olur ve 'ı' `[a-z]` içinde olmadığı için adres yine reddedilirdi
(0017'nin dersi).

Üç yeni sınama kabul edilen hâlleri, iki yenisi de **yarım adresin hâlâ
reddedildiğini** ölçüyor (küçültme "her şeyi kabul et" demek değil).

---

## MIYOP-107 · P2 · Kaldırılan duyuruların CSS'i kalmıştı

Uydurma duyurular (MIYOP-059) ekrandan kaldırılmıştı; CSS'i
kalmıştı: `.unified-login-announcement`, `...-list`, `...time` ve üç
grup kuralındaki payı.

Ölçüm: beş herkese açık sayfa ve iki vitrin mimari testi — hepsinde
**0 kullanım**. 28.10 tarihli tam depo kopyasında da 0.

Silindi, yerine neyin niçin silindiğini söyleyen bir yorum kondu ve
`giris-vitrini-dogru-soyler.arch.test.ts` artık sınıfın **geri
gelmediğini** ölçüyor.

⚠️ **Yanında duran `.unified-login-reference*` kuralları da kullanılmış
görünmüyor** ama bunu yalnız beş sayfada ölçebildim; depo genelinde
arama yapılamadı. Silinmedi. Sabah tek komutla ölçülebilir:

    Select-String -Path src\*.tsx,src\**\*.tsx -Pattern "unified-login-reference"

Çıktı boşsa aynı yolla kaldırılır.

---

## Açık kalan iki borç (bu turda kapanmadı)

1. **Lisans kataloğu hâlâ eski adisyon ürünü** (Codex'in 2. maddesi).
   Bilinen borç; 8 sayfa dosyası bu katalogdan besleniyor. Müşteri
   ekranında eski ürün adı görünüyor mu sorusu **elle ölçülmeli**.
2. **6 canlı kiracının 6'sı elle girilmiş deneme kaydı** — ilk gerçek
   müşteriden önce temizlenecek.
