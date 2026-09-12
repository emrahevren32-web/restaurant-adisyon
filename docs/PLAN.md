# MİYOP · Production Foundation — Plan

> Bu dosya **mevcut durumu** anlatır. Kararların gerekçesi `docs/adr/` içindedir.
> Her dilim bittiğinde bu dosya güncellenir. Tek doğruluk kaynağı budur.

**Durum:** Dilim 0 — sürüyor (G0–G3 bitti, G4 kısmen, G6 yazıldı/kısmen doğrulandı — JWT claim önkoşulu bekleniyor)
**Son güncelleme:** 2026-08-26

---

## 1. Ürün prensibi

> **Yarım yamalak bir ürün olacağına, eksik olsun ama çalışan bir ürün olsun.**

Bu cümlenin operasyonel karşılığı üç kuraldır ve üçü de tartışmaya kapalıdır:

1. **Görünen her ekran gerçek veriye bağlıdır.** Mock veriye bağlı bir ekran menüde yer almaz.
   Yarım bağlı ekran yoktur — ya tamamen bağlıdır ya da görünmez.
2. **"Çalışıyor" demek, build geçiyor demek değildir.** Bir dilim, iş kuralları otomatik test
   ile doğrulandığında biter.
3. **Vaat ettiğimiz her özellik gerçekten çalışır.** Demoda gösterdiğimiz hiçbir şey
   "yakında" değildir. Menüde olan çalışır; çalışmayan menüde değildir.

---

## 2. Temel sözleşme

Claude, GPT ve Emrah arasında kapatılmış mimari kararlar. Bunlar yeniden tartışılmaz;
değiştirmek isteyen yeni bir ADR açar.

| # | Karar | ADR |
|---|-------|-----|
| 1 | **Dikey dilim** — katman katman değil, uçtan uca dar dilimler halinde ilerlenir | `003` |
| 2 | **Her dilim kendi testiyle biter** — test ayrı bir faz değildir | `003` |
| 3 | **`StockMovement` = tek gerçek**; `currentQty` hareketlerden türetilir | `001` |
| 4 | **Tenant izolasyonu PostgreSQL RLS ile zorlanır**; uygulama katmanı ikinci hattır | `004` |
| 5 | **Migrasyon kapsamı sınırlıdır** — kapsam dışı modüller dondurulur, silinmez | `002` |
| 6 | **Yeni modül geliştirilmez.** Her yeni fikir `docs/backlog.md`'ye yazılır | `002` |

---

## 3. Dilim panosu

| Dilim | Konu | Durum | Test |
|-------|------|-------|------|
| **0** | Çekirdek şema · Auth · Tenant · RBAC · RLS · repository sınırı · test altyapısı | 🟡 Sürüyor | 22 ✅ · 12 şema ✅ |
| **1** | Stok hareket defteri (append-only, reversal, idempotency, lot, türetilmiş miktar) | ⬜ | — |
| **2** | Satın Alma → Mal Kabul → Stok · **pilot burada başlar** | ⬜ | — |
| **3** | Reçete → Üretim İş Emri → Tüketim → Mamul | ⬜ | — |
| **4** | Sevkiyat → Stok çıkışı → İrsaliye | ⬜ | — |
| **5** | İzlenebilirlik / geri çağırma | ⬜ | — |
| **6** | Sayım · fire · düzeltme | ⬜ | — |
| **7** | Yedekleme · geri yükleme · dışa aktarma | ⬜ | — |

Bir dilim ancak şu üçü sağlandığında ✅ olur:
kod yazıldı **ve** dilimin testleri geçiyor **ve** ADR'de tanımlı "bitti tanımı" karşılandı.

---

## 4. Roller

| Kim | Ne yapar | Ne yapmaz |
|-----|----------|-----------|
| **Claude** | Mimari, şema, ADR, dilim planı, kod incelemesi | Repoya doğrudan yazmaz |
| **Codex** | Repo içinde uygulama, mekanik taşıma, test yazımı | Mimari karar vermez |
| **GPT** | İkinci görüş, planı zorlama, mimari kontrol | Uygulama sırası belirlemez |
| **Emrah** | Ürün kararı, öncelik, pilot müşteri, son söz | — |
| **Testler** | **Hakem.** Anlaşmazlık test sonucuyla kapanır | — |

Akış: `Claude ADR yazar → Codex uygular → Claude inceler → testler geçerse ADR kapanır.`

> **2026-08-25 notu:** G4'ün bu son parçasında (Supabase Auth entegrasyonu) Claude,
> Cowork oturumu üzerinden bilgisayara doğrudan bağlanabildiği için kodu bizzat yazdı
> ve cihaza yazdı; Codex bu değişikliği **inceleme** rolünde devraldı. Roller tablosu
> değişmedi, sadece bu dilimde uygulama adımını da Claude yürüttü.

---

## 5. Değişmeyen kurallar

- Parola hiçbir yerde düz metin saklanmaz. İstisna yok.
- `stock_movement` satırı güncellenmez ve silinmez. Düzeltme = ters kayıt.
- Stok yazan tek kapı `postMovement()`'tır. Başka hiçbir yerden stok yazılmaz.
- Her repository çağrısının ilk parametresi `TenantCtx`'tir. Unutulması derleme hatasıdır.
- Yeni tablo açılıyorsa RLS ile birlikte açılır; sonradan eklenmez.
- Kapsam dışı modüle tek satır geliştirme yapılmaz.

---

## 6. Kapsam özeti

**İçeride (migre edilir):** kimlik/yetki/şube, stok kartları ve hareketleri, lot, mal kabul,
reçete, satın alma talebi/siparişi, tedarikçi, üretim iş emri, sevkiyat, izlenebilirlik,
sayım/fire, denetim kaydı, yedekleme.

**Dışarıda (dondurulur):** adisyon/masa/QR/garson, finans/cari/kasa, personel, KPI ve AI
analiz ekranları, platform/lisans/abonelik/destek, HACCP ve kalite form ekranlarının çoğu.

Tam liste: `docs/adr/002-migrasyon-kapsami.md`

---

## 7. Dilim 0 ilerlemesi

| Paket | Konu | Durum |
|---|---|---|
| G0 | Hazırlık — build, dal, docs | ✅ |
| G1 | Test altyapısı — Vitest, CI, ilk testler | ✅ 13 test |
| G2 | Kapsam daraltma — 138 → 24 menü ögesi | ✅ |
| G3 | Veritabanı ve şema | ✅ 14 tablo · 12 şema kontrolü |
| G4 | Kimlik doğrulama | 🟡 İlk yönetici Supabase Auth ile giriş yapıyor; kalanlar aşağıda |
| G5 | Yetkilendirme | ✅ 32 izin · 12 rol · çoka-çok `user_role` · atama RPC'si · `docs/yetki-cercevesi.md` |
| G6 | Repository sınırı | 🟡 G6.1/G6.2/G6.3/G6.6 ✅, **G6.5 ✅** (canlı Postgres'e karşı 28/28, 2026-08-28), G6.4 🟡 I1-I12'den 11'i yeşil — **yalnızca I10 açık** |
| G7 | Kabul | 🟡 G7.1 ✅ 12/12 · G7.2 ✅ negatif kontrol · G7.5 ✅ 28/28 canlı sözleşme · **G7.3 (hata takibi) ⬜** |

**G1'de bulunan hata:** Şube kodu ve kullanıcı adı karşılaştırması Türkçe yerel ayarıyla
küçültme yapıyordu; `'ISTANBUL'` → `'ıstanbul'` olduğu için `'istanbul'` ile eşleşmiyor,
aynı kodla ikinci şube ve aynı adla ikinci kullanıcı açılabiliyordu. `core/identifier.ts`
ile düzeltildi, 4 regresyon testi yazıldı. Test altyapısı ilk gününde işini yaptı.

**G3'te bulunan tuzak:** Supabase'in "Enable automatic RLS" ayarı public şemasındaki
her tabloda RLS'i otomatik açıyor. İyi bir varsayılan, ama **politikası olmayan RLS
herkese kapalı** demektir. Tenant'a ait olmayan beş referans tablosu (`permission`,
`role`, `role_permission`, `uom`, `uom_conversion`) politikasız kalmıştı; uygulama
bağlandığında yetki listesini okuyamaz, birim dönüşümü yapamazdı. `0005` ile okuma
politikası eklendi. Kural: durum sorgusunda `politika` sütunu 0 olan satır kalmamalı.

### Veritabanı durumu

- **14 tablo**, hepsinde RLS açık + force + en az bir politika
- `stock_movement` append-only (UPDATE/DELETE tetikleyiciyle reddediliyor)
- Idempotency, ters kayıt tekilliği, lot zorunluluğu, birim dönüşümü şemada
- `stock_item` tablosunda `current_qty` kolonu **yok** — miktar `stock_balance`
  görünümünden türetiliyor
- Migration'lar: `db/migrations/0000`–`0008`, hepsi tekrar çalıştırılabilir
- `anon` rolü müşteri verisinin hiçbirine erişemiyor; yalnızca beş referans tablosu açık
- İlk tenant (`MIYOP`), firma, merkez şube ve ilk yönetici (`emrah`, Supabase Auth
  UID'sine eşleşmiş) `0008_ilk_yonetici.sql` ile kuruldu

**G4'te bulunan iki açık (kapatıldı):**

1. **Görünümler RLS'i deliyordu.** PostgreSQL'de görünümler varsayılan olarak sahibinin
   yetkileriyle çalışır. `stock_balance` görünümünü sorgulayan bir kullanıcı altındaki
   `stock_movement` tablosunun RLS politikasını atlayıp **tüm tenant'ların stoklarını**
   görürdü. Tenant izolasyonunu tabloda kurmuştuk ama stok miktarını okuduğumuz asıl yer
   o görünümdü. `security_invoker = on` ile kapatıldı (`0006`). RLS kurulmuş sistemlerde
   en sık gözden kaçan açık budur.

2. **`anon` rolünün her tabloda GRANT'i vardı.** Supabase'in public şemasındaki varsayılan
   izinlerinden geliyordu. Veri sızmıyordu — RLS süzüyordu — ama koruma tek katmana
   inmişti. Politikadaki tek bir yazım hatası doğrudan sızıntıya dönerdi. `0007` ile
   `anon` müşteri verisinden tamamen çıkarıldı; iki bağımsız savunma hattı geri geldi.

> Bu iki açığı da **test yakalamadı** — yetki tablosuna bakıldığı için görüldü. Testler
> "çalışıyor mu" diye sorar, "fazla yetki var mı" diye sormaz. G7'deki iki-tenant
> kontrolü bu boşluğu kapatacak.

### G4'ün bu turda kapanan parçası (2026-08-25)

Yapılanlar:

1. `db/migrations/0008_ilk_yonetici.sql` — ilk tenant/firma/merkez şube + ilk yöneticinin
   (Supabase Authentication UID `141939e8-…`) `app_user` ile eşleşmesi. Emrah tarafından
   Supabase SQL Editor'de çalıştırıldı ve doğrulama sorgusuyla teyit edildi.
2. `storage.ts` — `authenticateUser()` artık `x.password === password` ile localStorage'a
   bakmıyor; `supabase.auth.signInWithPassword()` ile gerçek girişi doğruluyor, sonra
   `app_user.auth_user_id` üzerinden profili çekiyor. `pasif` kullanıcı ve eşleşmeyen
   hesap reddediliyor, yarım oturum bırakmamak için `signOut()` çağrılıyor.
3. Uygulama açılışında sessizce düz metin `admin`/`admin123` hesabı oluşturan
   `ensureDefaultAdmin()` tohumlaması kaldırıldı (fonksiyon imzası geriye dönük uyumluluk
   için duruyor, artık sadece sektör önbelleğini ısıtıyor).
4. Giriş ekranı (`Login.tsx`) "Kullanıcı Adı" yerine "E-posta" istiyor — Supabase Auth
   e-posta/şifre ile çalıştığı için zorunlu bir değişiklik.
5. `src/auth/authenticateUser.test.ts` — 5 yeni test: yanlış giriş reddi, `app_user`
   eşleşmesi yoksa oturum kapatma, pasif kullanıcı reddi, başarılı girişte dönen
   nesnede düz metin parola olmadığının kanıtı, rol eşleme.

**Bilinçli kapsam kararı — `User.password` alanı tamamen silinmedi:**
`dilim-0-gorevler.md` G4.4 alanı tipten tamamen kaldırmayı öngörüyordu. Bu tam olarak
yapılmadı; alan `password?: string` olarak **opsiyonel** yapıldı. Sebep: `CompanySetupWizard`
ve `BusinessRegistrationSystem` (self-servis işletme başvuru/kurulum akışları) hâlâ bu
alana yazıyor ve ADR-002 gereği **dondurulmuş** durumdalar — kapsam dışı modüle tek satır
bile geliştirme yapılmaz kuralı, mekanik bir tip temizliği için bile geçerli sayıldı.
Gerçek giriş yolunda (`authenticateUser`) bu alan hiç kullanılmıyor/yazılmıyor; sadece o
iki dondurulmuş ekranda ölü/etkisiz biçimde duruyor. Tam kapanış, o iki modül gerçek
backend'e taşınırken (self-servis platform açıldığında, `docs/backlog.md`) yapılabilir.

**Karar verildi (2026-08-25, Emrah onayı):** `dilim-0-gorevler.md` G4.1 (argon2id hash) ve
G4.3 (özel parola sıfırlama akışı) **kapatıldı.** İkisi de PLAN.md'nin "Supabase Auth'a
geçiyoruz" kararından **önce** yazılmıştı ve artık gereksizdi — Supabase Auth parolayı
zaten güvenli hashliyor ve hazır bir "şifremi unuttum" e-postası sunuyor. Kendi
hash/reset sistemimizi kurmuyoruz. Ayrıntı: ADR-005 revizyon notu.

Aynı oturumda ADR-005'in **Drizzle** ve **Zod** satırları da revize edildi: ikisi de
kullanılmadı, düz SQL migration + `supabase-js` istemcisiyle devam ediliyor
(gerekçe ADR-005'te).

**Bu geçişte bulunan iki küçük not (acil değil, kayda geçirildi):**

1. `db/migrations/0001`'de `PERMISSION_CATALOG`'un tamamı değil, kapsam içi **9 izin**
   seed edilmiş (15'in geri kalanı dondurulmuş modüllere ait — doğru bir daraltma,
   ama görev listesinde işaretli değildi). `dilim-0-gorevler.md` G5.1'e not düşüldü.
2. Migration geri alınabilirliği (G3.8, "her migration'ın down'ı yazılı ve en az bir
   kez çalıştırılmış") hiç yapılmamış. Migration'lar ileri yönde tekrar çalıştırılabilir
   ama resmi bir "down" script'i yok. G3'ün gerçek açık maddesi budur.

### G6'nın ilk yarısı (2026-08-25) — G6.1-G6.4

Yazılanlar:

- `src/core/context.ts` — `TenantCtx` tipi.
- `src/core/stock/stock.repository.ts` — `StockRepository` arayüzü (ADR-001 §"Uygulama
  arayüzü" birebir) + iki uygulamanın da fırlatması gereken ortak hata sınıfları
  (`DuplicateIdempotencyKeyError` vb.).
- `src/core/stock/stock.localstorage.ts`, `uom.ts`, `stock-item-lookup.ts` —
  `LocalStorageStockRepository`.
- `src/core/stock/stock.contract.test.ts` — I1-I12 sözleşme testleri.

**Önemli bulgu: G6.3 bir "taşıma" değil, yeni bir uygulama oldu.** `dilim-0-gorevler.md`
G6.3, bugünkü `storage.ts` stok kodunun arayüzün arkasına mekanik olarak taşınacağını
varsayıyordu. İncelemede bu varsayım yanlış çıktı: bugünkü model (`StockItem.currentQty`
gerçek, `StockMovement` yalnızca sonradan yazılan bir günlük) ADR-001'in tam olarak
reddettiği modeldir ve I1-I12'nin gerektirdiği hiçbir kontrolü (idempotency, tekil ters
kayıt, append-only) içermiyor. `LocalStorageStockRepository` bu yüzden sıfırdan,
ADR-001'e uygun yazıldı; legacy `ra_stock_movements` anahtarına dokunmadı, kendi ayrı
defterini tutuyor. Legacy ekranların buna bağlanması Dilim 1'in işi.

**İki küçük tasarım notu:**

1. `StockItemLookup` — ADR-001'in arayüzünde olmayan, yalnızca local uygulamanın I7/I8
   için ihtiyaç duyduğu küçük bir ek (kalemin `base_uom`/`tracks_lot` bilgisi). Postgres
   uygulamasının buna ihtiyacı yok, veritabanı tetikleyicisi zaten kontrol ediyor.
2. **I12 (negatif bakiye politikası) açık kaldı.** ADR-001 bunun "tenant ayarına göre"
   davrandığını söylüyor ama hiçbir migration'da bunu tutacak bir sütun yok. Şema
   eklenmeden ne Local ne Postgres tarafında uygulanabilir — G6'yı tam kapatmadan önce
   küçük bir karar/migration gerekiyor.

`npm run build` / `npm run typecheck` / `npm test` ile doğrulanması bekleniyor.

**Codex incelemesi (2026-08-25) — geçti, 3 gerçek hata bulundu ve düzeltildi:**

1. `postMovement` yalnızca `quantity === 0`'ı reddediyordu; `NaN`/`Infinity` sızabiliyordu
   (I6 açığı). `!Number.isFinite(...)` kontrolü eklendi.
2. `reverseMovement` `branchId`'ye göre filtrelemiyordu — aynı tenant'taki başka bir şube
   diğerinin hareketini ters çevirebilirdi. Filtre eklendi.
3. Sözleşme testlerinde iki zayıf test vardı (I3 sıfır bakiyeden başlıyordu, I9 tenant ve
   branch'i birlikte değiştiriyordu — kod tenant filtresini kaybetse bile geçebilirdi).
   İkisi de güçlendirildi, I7'ye uçtan uca bir test eklendi.

Ayrıca `NewMovement.note` alanının ADR-001'in kod bloğunda olmadığı fark edildi, ADR-001'e
işlendi. Tüm düzeltmeler `docs/dilim-0-gorevler.md` G6 notuna da yazıldı. Codex kendi
tarafında `npx vitest run` ve `npm run typecheck`'i çalıştırıp temiz geçtiğini doğruladı.

### G3.8 kapandı (2026-08-25) — plandışı ama gerçek bir sınamayla

`db/migrations/geri_alma_0001-0008.sql` yazıldı: 0001–0008'in oluşturduğu tüm tabloları,
görünümleri, fonksiyonları, tetikleyicileri ve politikaları doğru bağımlılık sırasıyla
siliyor (0006/0007'nin GRANT sertleştirmesi kasıtlı hariç).

**Kaza:** Emrah bunu, talimat "ayrı boş bir test projesinde dene" olmasına rağmen
**üretim projesinde** çalıştırdı — `tenant`, `uom` gibi tablolar gerçekten silindi,
`npm test`'te 3 test (`supabase.connection.test.ts`) bu yüzden kırmızı çıktı. Gerçek
müşteri verisi yoktu (yalnızca bootstrap tenant/firma/şube/admin), Emrah `0001`→`0008`'i
sırayla tekrar çalıştırdı ve **tam olarak eski hâline döndü** — RLS/force/politika,
`anon` kısıtlaması ve `emrah` yönetici hesabı doğrulama sorgularıyla teyit edildi
(restorasyon öncesiyle birebir aynı sonuç). Bu, "geri al → tekrar kur" döngüsünün fiilen
bir kez çalıştırılıp kanıtlanmış olması demek — G3.8'in gerçek gereksinimi bu yolla
karşılandı. `docs/dilim-0-gorevler.md`'ye işlendi, G3 tamamen kapandı.

**Ders:** Böyle yıkıcı bir script verilirken hangi Supabase projesinin açık olduğu da
adım adım teyit ettirilecek — yalnızca "ayrı projede çalıştır" demek yetmiyor.

### G6.5 / G6.6 ve JWT tenant_id claim bulgusu (2026-08-26)

Yazılanlar:

- `src/core/stock/stock.postgres.ts` — `PostgresStockRepository`. `db/migrations/0003`
  şemasına karşı çalışıyor; I2/I4'ü kendi kontrolüyle değil veritabanının unique
  index'lerine yönlendirerek uyguluyor (Postgres hata kodu → sözleşme hatası çevirisi:
  `23505`→idempotency/reversal-once, `23502`→lot zorunluluğu, `23514`→sıfır miktar),
  I6/I8'i ayrıca istemci tarafında da hızlı-başarısızlıkla doğruluyor.
- `src/core/stock/stock.postgres.test.ts` — 23 senaryo, gerçek Postgres'e DEĞİL, elle
  yazılmış sahte (fake) bir `SupabaseClient`'a karşı. Sorgu zincirinin doğru kurulduğunu
  ve hata kodu çevirisinin doğru olduğunu kanıtlıyor; RLS'i, tetikleyicileri, gerçek
  unique index'leri SINAMIYOR — o yalnızca canlı Postgres'e karşı mümkün.
- `src/core/stock/index.ts` — G6.6 uygulama seçici. `VITE_STOCK_REPOSITORY_MODE` env
  değişkeniyle `local`/`postgres` arasında seçiyor, tanımsız/tanınmayan değerde
  bilinçli olarak `local`'e düşüyor (üretimde sessizce boş sonuç vermek yerine).
- `db/migrations/0009_jwt_tenant_claim.sql` — aşağıdaki bulguyu kapatan Custom Access
  Token Hook.

**Bulgu: JWT'de `tenant_id` claim'i hiç üretilmiyordu.** `PostgresStockRepository`
yazılırken fark edildi — `app.current_tenant_id()` (0001) `tenant_id`'yi Supabase Auth
JWT'sinden okuyor ama bunu JWT'ye yazan hiçbir mekanizma yoktu (grep: sıfır eşleşme).
Güvenlik açığı değil (RLS varsayılan kapalı — claim yoksa her şeyi süzer) ama gerçek bir
işlevsel engel: `PostgresStockRepository` canlı Supabase'e bağlansa bile her sorguda sıfır
satır görürdü. `0009`, `app_user.tenant_id`'yi JWT'ye yazan bir "Custom Access Token Hook"
kuruyor. SQL Editor'de çalıştırmak yetmiyor — devreye almak için Supabase Dashboard'da
BİR KEZ, sırsız bir adım gerekiyor (Authentication → Hooks → Customize Access Token (JWT)
Claims → Enable → Postgres Function → şema `app`, fonksiyon `custom_access_token_hook` →
Save). Ayrıntı ve doğrulama adımı `db/migrations/README.md`'de.

**Bu yüzden G6.5 tam kapanmadı:** Elimizde kodun doğru yazıldığına dair güçlü ama dolaylı
kanıt var (tip kontrolü + mock testler); `stock.contract.test.ts`'in (I1-I12) canlı bir
Postgres'e karşı geçtiğine dair DOĞRUDAN kanıt yok. Bu, Dashboard adımı atıldıktan sonra
ayrı bir iş — gerekirse ayrı, boş bir Supabase projesinde (G3.8'deki gibi) denenebilir.

**Güncelleme (2026-08-26, aynı gün):** Emrah `0009` ve `0010`'u üretim projesinde çalıştırdı
ve Dashboard adımını (Authentication → Hooks → Customize Access Token (JWT) Claims →
Postgres Function → şema `app`, fonksiyon `custom_access_token_hook`) tamamladı —
ekran görüntüsüyle "ENABLED" durumu teyit edildi. Yani **önkoşulun kendisi artık üretimde
canlı**; yalnızca `stock.contract.test.ts`'in buna karşı GERÇEKTEN çalıştırılması hâlâ
yapılmadı (bilinçli olarak G7'ye ertelendi — bkz. az yukarısı). `npm run typecheck` ve
`npm test` de cihazda çalıştırıldı: **76/76 test yeşil** (I12 eklerinden önce 65 idi;
+11 yeni test — 5 Postgres mock, 6 Local sözleşme — beklenen sayıyla birebir örtüşüyor).

**Karar (2026-08-26, Emrah onayı):** Canlı Postgres testi ŞİMDİ ayrıca yapılmayacak;
G7'nin (iki tenant izolasyon kabul testi) ihtiyaç duyduğu altyapıyla (RLS'in gerçekten
zorlandığı, süper kullanıcı olmayan bir bağlantı) BİRLİKTE, tek bir scratch projede
yapılacak. Bu yüzden bugünden itibaren "Emrah'tan bekleniyor" listesinde yalnızca JWT
Dashboard adımı var; canlı test G7 zamanı geldiğinde ele alınacak.

### I12 kapandı (2026-08-26) — negatif bakiye politikası

G6.5 sırasında zaten "karar bekliyor" diye işaretlenmiş olan I12 de bu turda kapatıldı:
`db/migrations/0010_negatif_bakiye_politikasi.sql`, `tenant` tablosuna `negative_stock_policy`
(`allow`\|`warn`\|`block`, varsayılan `block`) ekledi. Kontrol veritabanı tetikleyicisinde
değil — hem `LocalStorageStockRepository.postMovement()` hem `PostgresStockRepository.postMovement()`
hareketten sonraki bakiyeyi hesaplayıp negatifse politikayı okuyor: `block` reddediyor,
`warn` kabul edip `Movement.warning`'i dolduruyor, `allow` sessizce kabul ediyor.
`reverseMovement()` bilinçli olarak muaf (I3, I12'den önceliklidir). Yeni `TenantPolicyLookup`
port'u (`StockItemLookup` ile aynı desen) ve `LocalStorageStockRepository`'nin opsiyonel
ikinci parametresi eklendi (varsayılan `block`, geriye dönük uyumlu). 11 yeni test (6 Local
sözleşme testi + 5 Postgres mock testi) ve gerçek koda karşı 20 senaryoluk manuel bir duman
testiyle doğrulandı. **Sonuç: I1-I12'den 11'i artık test ediliyor, yalnızca I10 (snapshot
mutabakatı) açık** — ADR-001'in kendisi bunu bir snapshot mekanizması gerekene kadar zaten
erteliyor, bu yüzden aktif bir açık sayılmıyor.

### Codex incelemesi kapandı (2026-08-26) — 0011, 0012, 0013

G6.5/G6.6 + I12 paketi bağımsız incelemeye verildi. İnceleme, "bilinen sınır olarak
kabul edildi" diye yazdığımız iki maddenin aslında **kabul edilebilir sınır olmadığını**
gösterdi ve bizim hiç görmediğimiz bir yetki yükseltmesine kapı açtı. Hepsi kapatıldı.

| Bulgu | Neden ciddiydi | Kapanış |
|---|---|---|
| I12 doğrudan `INSERT` ile atlanabiliyordu | `0006` her kullanıcıya `stock_movement`'a `INSERT` veriyor; repository'ye uğramayan tek bir REST çağrısı kontrolü tamamen atlıyordu. Yalnızca uygulama kodunun uyduğu kural invariant değil, gelenektir. | `0011` — BEFORE INSERT tetikleyicisi |
| I12'de TOCTOU yarışı | Bakiye 10 iken iki terminal aynı anda −6 yazarsa ikisi de "sonuç 4" hesaplar, defter −2'ye düşerdi. Mutfakta eşzamanlı düşüm olağandır; teorik bir risk değildi. | `0011` — `pg_advisory_xact_lock` |
| Her kullanıcı kendini `admin` yapabiliyordu | `0006`'daki `grant ... update on ... app_user` **sütunları** süzmüyordu; RLS satırı korur, sütunu korumaz. Tek satırlık bir REST çağrısıyla `role_code = 'admin'`. İncelemenin doğrudan maddesi değildi — aynı satırın aynı kusurunun daha ağır sonucu olarak bulundu. | `0012` — kolon seviyesi GRANT |
| Politikayı herkes değiştirebiliyordu | Aynı kusur `tenant.negative_stock_policy` üzerinde: sıradan kullanıcı politikayı `allow` yapıp I12'yi kendi tenant'ı için kapatabiliyordu. | `0012` + `app.set_negative_stock_policy()` RPC |
| Pasif kullanıcı JWT claim'i almaya devam ediyordu | `0009` yalnızca `auth_user_id`'ye bakıyordu. Giriş ekranı pasifi reddediyor, ama refresh token'ı olan biri uygulamayı hiç açmadan jeton yenileyebilir. Kapı jetonu basan yerde kapanmalı. | `0013` — aktif kullanıcı + aktif tenant şartı, eşleşme yoksa claim açıkça silinir |
| `23502`/`23514` çevirisi fazla genişti | Her `23502` "lot zorunlu", her `23514` "miktar sıfır olamaz" diye çevriliyordu. İkisi de genel PostgreSQL kodları — alakasız veritabanı hataları kullanıcıya yanlış adla gösteriliyordu. | `stock.postgres.ts` — `MI008`/`MI012` özel kodları + kısıt adı eşleşmesi |
| `createStockRepository` politikayı bağlamıyordu | Fabrika `TenantPolicyLookup` almıyordu; local modda politika HER tenant için sabit `block`'a düşüyordu. I12'nin `warn`/`allow` dalları testlerde geçiyordu (testler repository'yi doğrudan kuruyor) ama gerçek uygulamada ölü koddu. | `index.ts` — ikinci parametre |
| `Movement.warning` iki uygulamada farklı davranıyordu | Local saklıyor, Postgres saklamıyordu. Aynı sözleşme testlerinden geçmesi gereken iki uygulamada sapma; `Movement` tipinin bir alanının uygulamaya göre değişmesi sözleşmeyi belirsizleştirir. | `stock.localstorage.ts` yazarken düşürüyor; sözleşme netleşti |
| Ters kayıt muafiyet testi yanlış pozitifti | `+10` yazıp tersliyor, bakiye 0 oluyordu. 0 negatif olmadığı için muafiyet KALDIRILMIŞ olsa bile test geçerdi — ölçtüğünü iddia ettiği şeyi hiç ölçmüyordu. | Gerçek senaryoyla yeniden yazıldı: `+10`, `−8`, `+10`'u tersle → `−8` |

Ayrıca üç yeni sözleşme testi eklendi (tam sıfır sınırı, farklı UOM ile negatif sonuç,
`warning`'in `ledgerOf`'ta boş dönmesi) ve `23502`/`23514`'ün YANLIŞ eşleşmediğini
kanıtlayan iki negatif test yazıldı. `npm run typecheck` temiz, `npm test` **83/83**
(76 → 83; +3 sözleşme, +4 Postgres mock testi — sayı birebir tuttuğu için hiçbir test
sessizce atlanmadı).

#### I12 artık "kurulu" değil, KANITLANMIŞ (2026-08-26)

Yukarıdaki testlerin tamamı mock'lara veya LocalStorage'a karşı koşuyor — hiçbiri
`0011` tetikleyicisinin canlıda gerçekten ateşlendiğini göstermiyordu. Özellikle
`MI012` özel hata kodu, PL/pgSQL'de yalnızca ÇALIŞMA ANINDA doğrulanır: kurulum
sırasında PostgreSQL onu denetlemez, yani "migration hatasız çalıştı" o kodun
geçerli olduğunu kanıtlamaz.

Bu yüzden `db/migrations/i12_canli_sinama.sql` yazıldı ve üretim projesinde
koşuldu. Sınama, uygulamayı tamamen devre dışı bırakıp **doğrudan veritabanına
yazar** — yani Codex'in "repository'ye uğramayan bir REST çağrısı kontrolü atlar"
dediği yolun ta kendisini dener. Sonuç **4/4**:

| # | Senaryo | Beklenen | Gerçekleşen |
|---|---|---|---|
| 1 | `+10` giriş | kabul | kabul edildi |
| 2 | `-15` çıkış (bakiye −5 olurdu) | **`MI012` ile RED** | `MI012` ile reddedildi |
| 3 | `-10` çıkış (bakiye tam 0) | kabul | kabul edildi — sınır `< 0`, `<= 0` değil |
| 4 | 1. hareketin ters kaydı (bakiye −10 olur) | kabul | kabul edildi — I3 > I12 muafiyeti çalışıyor |

Sınama üretim defterine **hiçbir şey bırakmaz**: sonunda bilerek bir istisna
fırlatıp tüm işlemi geri alır. Bu bir tercih değil zorunluluktu — `stock_movement`
append-only bir defterdir (0003), silme tetikleyiciyle yasaktır; oraya yazılan bir
sınama hareketi bir daha silinemezdi. Rapor, geri almayı yapan istisnanın mesajının
içinde döner (SQL Editor'de kırmızı bir hata kutusu olarak görünür — doğrusu budur).

Böylece I12, ADR-001'in en uzun süre açık kalan maddesi, artık **hem uygulanmış hem
canlıda kanıtlanmış** durumda. Dilim 0'da bu seviyeye ulaşan ilk invariant budur.

**Kayda geçen ders:** "bilinen sınır olarak dokümante ettik" bir açığı kapatmaz.
`0010`'un gerekçesi — *"veritabanı seviyesinde sert bir `check` kısıtı `warn`/`allow`
politikalarını imkansız kılardı"* — öncülü doğru, sonucu yanlış bir akıl yürütmeydi.
Bir `check` kısıtı gerçekten politikayı okuyamaz; ama bir **tetikleyici** okuyabilir.
Üçüncü seçenek hiç düşünülmediği için yanlış karar dürüstçe dokümante edildi, ve
dürüstçe dokümante edilmiş olması onu doğru yapmadı.

### G7 · İki kiracı izolasyonu CANLI olarak KANITLANDI (2026-08-27)

Dilim 0'ın en uzun süredir açık duran iddiası — "RLS kuruldu ama kanıtlanmadı"
(bkz. `db/migrations/README.md` §Bilinen sınır) — artık kapandı.

**Kurulum:** ayrı bir Supabase projesi (`miyop-g7-test`) açıldı, 0001-0015
birleştirilmiş olarak kuruldu, iki gerçek Auth hesabıyla iki kiracı (TESTA/TESTB)
oluşturuldu, JWT hook etkinleştirildi. Üretim projesine TEK BİR satır yazılmadı —
`stock_movement` append-only olduğu için oraya yazılan sınama verisi silinemezdi.
`live-client.ts` sınama URL'i üretimle aynıysa bilerek hata veriyor.

**Sonuç:** `npm run test:live` → **12/12 yeşil.** A, B'nin ne stok kalemini, ne
hareketini, ne bakiyesini, ne kullanıcısını, ne firmasını, ne şubesini görebiliyor;
kalemi kodla doğrudan aramak da işe yaramıyor. Aynısı ters yönde de geçerli.

**Negatif kontrol (asıl kanıt):** `g7_rls_kapat.sql` ile RLS kapatıldığında
**8 test kırmızıya döndü**, `g7_rls_ac.sql` ile açılınca hepsi geri yeşil oldu.
Yani test gerçekten izolasyonu ölçüyor, başka bir şeyi değil.

#### Negatif kontrol, TESTİN KENDİSİNDE bir kusur buldu

RLS kapalıyken dört test yeşil kaldı. Üçü beklenendi (JWT claim testleri RLS'ten
bağımsız). Dördüncüsü — "A, B'nin adına YAZAMAZ" — **yanlış pozitifti.**

Test, `branch_id` olarak var olmayan bir kimlik (`00000000-…`) gönderiyordu.
Yazma reddediliyordu ama RLS yüzünden değil, **yabancı anahtar kısıtı yüzünden**.
Bu yüzden koruma tamamen kapalıyken bile geçiyordu: ölçtüğünü iddia ettiği şeyi
hiç ölçmüyordu.

Bunu ortaya çıkaran şey testin kendisi değil, negatif kontroldü. Test artık B'nin
GERÇEK şubesini kullanıyor ve kodu her koşumda benzersiz üretiyor (sabit kod,
ikinci koşumda tekillik kısıtına takılıp aynı kusuru tekrar üretirdi).

**Düzeltme aynı yöntemle DOĞRULANDI (2026-08-27):** üçlü döngü yeniden koşuldu —
RLS açık **12/12 yeşil** → RLS kapalı **9 kırmızı** → RLS açık **12/12 yeşil**.
Önceki turda 9 değil 8 kırmızı vardı; aradaki fark tam olarak düzeltilen yazma
testidir. Yani kusurun giderildiği, kusuru bulan yöntemin kendisiyle kanıtlandı.

> Küçük iz: RLS kapalıyken yazma gerçekten başarılı olduğu için sınama projesinde
> TESTB'ye ait bir `SIZINTI-<zaman>` stok kalemi kaldı. Zararsız — `stock_item`
> append-only değil, proje zaten geçici. Üretimde hiçbir iz yok.

**Kayda geçen ders:** yeşil bir test, doğru sebepten yeşil olduğu kanıtlanana kadar
yalnızca bir izlenimdir. Bu turda hem RLS'i hem de kendi testimizi sınamış olduk;
ikincisi kaybetmedik, kazandık.

### Yetki çerçevesi kuruldu (2026-08-27)

Emrah'ın isteği: *"personel izinleri personele göre değişmeli… departmanlara göre
kimin hangi yetkiye sahip olması gerektiğini sen düşün ve doküman olarak bırak."*

İzin kataloğu koddan **veritabanına** taşındı: **32 izin**, **12 rol**, çoka-çok
`user_role` tablosu. Atama tek kapıdan yapılıyor — `public.assign_user_roles()` —
ve kendi kendine yükseltmeyi reddediyor: `super_admin` yalnızca super_admin,
`admin` yalnızca super_admin/admin tarafından verilebilir.

**Bu sırada gerçek bir yetki yükseltme kapatıldı.** `app_user.role_code` sütunu
oturum açmış **herhangi bir** kullanıcı tarafından yazılabiliyordu; yani her personel
tek bir istekle kendini admin yapabilirdi. `0012_yetki_sertlestirme.sql` bunu
sütun bazlı GRANT ile kapattı. (Buradaki tuzak: PostgreSQL'de tablo düzeyinde bir
GRANT dururken tek sütunu geri almak **işe yaramaz** — önce tablo düzeyi geri
alınmalı, sonra izin verilen sütunlar tek tek verilmelidir.)

Çerçevenin tamamı: **`docs/yetki-cercevesi.md`**. Yetki sorusu geldiğinde
tartışılacak yer orasıdır.

> **Bir savunma hattı değil, üç:** menü ögesini gizlemek ve rotayı kapatmak
> güvenlik **değildir** — arayüz temizliğidir. Gerçek sınır RLS ve sütun
> GRANT'leridir. Doküman bunu açıkça yazıyor ki ileride biri "menüde görünmüyor,
> demek ki güvenli" demesin.

Ayrıca `Users.tsx` içindeki **düz metin parola girişi kaldırıldı** — PLAN §5'in
"parola asla düz metin" kuralını ihlal ediyordu. Parola artık yalnızca Supabase
Auth'un işidir.

### G6.5 kapandı · Aynı suite, canlı Postgres'e karşı (2026-08-28)

Dilim 0'ın ikinci büyük iddiası kapandı: **`npm run test:live` → 40 geçti, 1 atlandı**
(atlanan, "yapılandırma yoksa atla" işaretçisi — doğru davranış). Bunun
**28'i sözleşme testidir** ve gövdeleri LocalStorage'ın koştuğunun birebir aynısıdır.

Testler kopyalanmadı, **tek gövdeye** alındı (`stock.contract.suite.ts`); iki ayrı
dosya olsaydı biri güncellenip diğeri unutulabilir ve "iki uygulamada da aynı suite
geçiyor" iddiası bir gün sessizce yanlış hâle gelebilirdi.

#### İlk koşumda 19 test düştü — ve iyi ki düştü

1. **`invalid input syntax for type uuid: "g7-test"`.** Canlı zemini kurarken
   `ctx.userId` alanına düz bir metin koymuştum. `postMovement` onu
   `stock_movement.created_by` sütununa yazıyor; orası `app_user`'a bağlı bir `uuid`.
   **LocalStorage bunu asla yakalayamazdı** — orada `created_by` yalnızca bir JSON
   alanı, tip denetimi yok.

   Bu benim hatamdı. Ama aynı zamanda bu maddenin **tam olarak neden var olduğunun**
   kanıtı: iki uygulamayı aynı testlerden geçirmek, birinin gizlediğini diğerinin
   ortaya çıkarması içindir. Madde işaretlendiği gün işini yaptı.

2. **`JWT issued at future`.** Kod hatası değil, saat kayması: jetonu Auth sunucusu
   basıyor, doğrulamayı veritabanı yapıyor. Çözüm, hatayı sessizce yutmak değil —
   **yalnızca bu hata sınıfına** özgü kısa bir yeniden deneme (5 × 1,5 sn) + testleri
   sırayla koşmak. Başka her hata olduğu gibi yukarı taşınıyor.

> Yöntem notu: defter silinemediği için (`stock_movement` append-only) "temiz zemin"
> silmekle değil, **her teste taze bir stok kalemi vererek** sağlanıyor. Bedeli, sınama
> projesinde birkaç düzine artık kayıt — o proje bunun için var.

### Yol haritası · 24/76 (%31,6)

İşaretlenen kutucuklar (son üç tur):
- ☑ PERMISSION_CATALOG tablolara taşındı — *Yetkisiz uç yok, varsayılan reddet*
- ☑ İki tenant izolasyon kabul testi + ham SQL kontrolü
- ☑ RLS kapatıldığında testler kırmızıya dönüyor mu?
- ☑ **PostgreSQL uygulaması, aynı testler** — *İki uygulamada da aynı suite geçiyor*

**İşaretlenmeyenler ve dürüst sebepleri:**

| Madde | Neden değil |
|---|---|
| `Sözleşme testleri (ADR-001 I1–I12)` — *12 değişmez de yeşil* | **11/12.** I10 (snapshot tutarlılığı) için henüz bir snapshot mekanizması yok; ADR-001 bunu bilerek erteliyor. Karar Emrah'a ait — bkz. §8. |
| `Mevcut localStorage kodunu arayüzün arkasına taşı` — *Uygulama aynen çalışıyor, davranış değişmiyor* | Arayüz ve uygulama var, testleri geçiyor. Ama kriter **uygulamanın kendisinin** o arayüzden geçtiğini söylüyor; ekranlar hâlâ eski `storage.ts` yoluna bakıyor. Aşama 2'nin ilk işi budur. |
| `password alanı User tipinden kalktı` | Alan `types.ts`'te duruyor. Onu yazan tek kod dondurulmuş modüllerde; ADR-002 "donmuş modülde geliştirme yapılmaz" diyor. Ekrandan giriş kaldırıldı, alan kaldı. |

## 8. Sonraki adım

### Karar bekleyen tek madde: I10

`Sözleşme testleri (ADR-001 I1–I12)` kutucuğunun kriteri **"12 değişmez de yeşil"**.
Şu an 11'i yeşil. I10 — *"bakiye anlık görüntüsü (snapshot) defterle tutarlıdır"* —
test edilemiyor, çünkü **henüz bir snapshot mekanizması yok**: bakiye her seferinde
defterden `SUM()` ile türetiliyor (ADR-001'in kararı) ve ADR-001 snapshot'ı
"performans gerektiğinde eklenir" diyerek bilerek erteliyor.

Yani seçenek ikiye iniyor:

- **(A) Kutucuğu açık bırak.** I10 gerçekten yapılmadı; snapshot yokken onu test
  etmek mümkün değil. Dilim 0 bu maddeyle 🟡 kalır, Aşama 2'ye geçilir.
- **(B) ADR-001'e bir ek yaz**, I10'un bu sürümde kapsam dışı olduğunu resmen kayda
  geçir ve kutucuğu 11/11 kriteriyle işaretle.

Ürünün prensibi ("her kutucuk bir taahhüt") **(A)**'yı işaret ediyor: snapshot
yokken "12 değişmez de yeşil" demek doğru olmaz. Ama bu Emrah'ın kararı.

### Demo yolu

Yol haritasının kendi kuralı: **A3 bitmeden demoya çıkılmaz.** Demo için sıradaki
iş Aşama 2 (**Depo çekirdeği** — satılabilir ilk çekirdek), ve onun ilk maddesi
yukarıdaki tabloda duruyor: ekranları eski `storage.ts` yolundan alıp
`StockRepository` arayüzünün arkasına almak. Arayüz, iki uygulaması ve 28 testi
hazır; eksik olan yalnızca ekranların ona bağlanması.

---

G4'ün ilk yöneticisi artık gerçek Supabase Auth ile giriş yapıyor, G4.1/G4.3 kapandı.
G3.8 kapandı (yukarıya bkz. — plandışı ama gerçek bir sınamayla). G6'nın tamamı
(G6.1-G6.6) artık yazılmış durumda; G6.5/G6.6 bu turda eklendi (yukarıya bkz.).
Kalanlar:

- **Tamamlandı (2026-08-26):** `npm run typecheck` + `npm test` cihazda çalıştırıldı —
  **76/76 test yeşil.** `0009` ve `0010` üretim projesinde çalıştırıldı, Dashboard adımı
  (Customize Access Token Hook → şema `app`, fonksiyon `custom_access_token_hook`)
  tamamlandı ve "ENABLED" olarak ekran görüntüsüyle doğrulandı. `0000`/`0004` doğrulama
  sorguları da tekrar koşuldu, hepsi GEÇTİ — hiçbir regresyon yok.
- **Karar verildi ve kapandı:** I12 (negatif bakiye politikası) — bkz. yukarıdaki
  "I12 kapandı" notu.
- **Ertelendi, G7 ile birlikte yapılacak (Emrah onayı, 2026-08-26):** `stock.contract.test.ts`'in
  `PostgresStockRepository`'ye karşı, canlı bir Supabase scratch projesinde çalıştırılması.
  Önkoşul (JWT hook) artık üretimde hazır; yalnızca testin kendisi henüz koşulmadı —
  bilinçli olarak G7'nin (iki tenant izolasyon kabul testi) altyapısıyla birlikte, tek
  seferde yapılacak. G6.5'in tam kapanması buna bağlı.
- **Önerilen (opsiyonel, ucuz bir sağlama):** Emrah uygulamada çıkış yapıp tekrar girdikten
  sonra tarayıcı konsolunda `db/migrations/0009_jwt_tenant_claim.sql`'in sonundaki JS
  satırını çalıştırıp JWT'sinde artık gerçekten bir `tenant_id` claim'i olduğunu görebilir
  — hook'un yalnızca "kurulu" değil "çalışıyor" olduğuna dair ucuz, doğrudan bir kanıt.
  Zorunlu değil, G7'de zaten dolaylı olarak sınanacak.

Kalan açık: **G4.5** — mevcut demo/localStorage kullanıcılarının (varsa gerçek personel
hesapları) Supabase Auth'a nasıl taşınacağı henüz tasarlanmadı. Şu an sadece ilk yönetici
gerçek giriş yapabiliyor. G5/G6 ile birlikte netleşecek. G6'dan sonra **G7 Kabul** (iki
tenant izolasyon testi) kalıyor — Dilim 0'ı asıl kapatacak iş budur.

Görev listesi: `docs/dilim-0-gorevler.md`
