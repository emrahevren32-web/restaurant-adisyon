# Dilim 0 · Görev listesi

> **Amaç:** Her şeyin üzerine oturacağı zemin. Bu dilim tek bir kullanıcı özelliği üretmez.
> Bitmeden Dilim 1 başlamaz.
>
> **Referanslar:** `docs/adr/001-stok-hareket-defteri.md`, `docs/adr/002-migrasyon-kapsami.md`
>
> Boyut: **S** ≈ yarım gün · **M** ≈ 1–2 gün · **L** ≈ 3–5 gün (AI destekli tek geliştirici)

---

## Dilim 0 bitti tanımı

Beşi birden sağlanmadan bu dilim kapanmaz:

1. `npm run build` **ve** `npm test` temiz geçiyor.
2. Menüde yalnızca kapsam içi ekranlar var; dondurulmuş bir rota doğrudan çağrılsa
   bile render etmiyor.
3. İki farklı tenant hesabı var ve biri diğerinin hiçbir kaydını göremiyor —
   **doğrudan veritabanına atılan ham SQL ile de doğrulanmış.**
4. Hiçbir yerde düz metin parola yok; `storage.ts` içindeki `x.password === password`
   satırı silinmiş.
5. Aynı sözleşme testleri hem localStorage hem PostgreSQL uygulamasında geçiyor.

---

## G0 · Hazırlık — kod yazmadan

| # | Görev | Boyut |
|---|-------|-------|
| **G0.1** | `npm run build` çalıştır, çıktıyı Claude'a ver. Şube yönetimi / firma profili / profil ekranları hiç derlenmedi — temiz başlangıç noktası olmadan başlamıyoruz. | S |
| **G0.2** | `docs/` klasörünü commit et: `PLAN.md`, `backlog.md`, `adr/001`, `adr/002`. | S |
| **G0.3** | `production-foundation` dalını aç. Bundan sonraki her şey bu dalda. | S |

> **G0.1 bitmeden aşağıya geçilmez.** Derlenmeyen bir kod tabanı üzerinde migrasyon
> yapılmaz; hangi hatanın senden hangisinin taşımadan geldiği ayırt edilemez.

---

## G1 · Test altyapısı — ilk iş

Test altyapısı **en başta** kurulur, çünkü bundan sonraki her görevin "bitti" kanıtı odur.

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G1.1** | Vitest kur. Vite zaten var, ek yapılandırma neredeyse yok. | `package.json`, `vitest.config.ts` | S |
| **G1.2** | `npm test` ve `npm run test:watch` script'leri. | `package.json` | S |
| **G1.3** | GitHub Actions: her push'ta `build` + `test`. Kırmızı CI ile merge edilmez. | `.github/workflows/ci.yml` | S |
| **G1.4** | İlk gerçek test: `branch-directory.service.ts` → `resolveHeadOfficeId` için 4 senaryo (pointer var / mirror flag var / ikisi de yok / hiç şube yok). Amaç: koşum düzeninin çalıştığını kanıtlamak. | `src/companies/branch-directory.service.test.ts` | S |

**Bitti:** CI yeşil, en az 4 test geçiyor.

---

## G2 · Kapsam daraltma

Veritabanından **önce** yapılır: hangi tabloların gerektiğini bu belirler.
ADR-002'nin uygulanmasıdır.

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G2.1** | Modül kaydına `scope: 'core' \| 'frozen'` alanı ekle. Tip zorunlu olsun — belirtmeyen modül derlenmesin. | `modules/business-workspace.registry.ts`, `navigation/app-navigation.types.ts` | S |
| **G2.2** | 34 modülü ADR-002'deki tabloya göre işaretle. 12 `core`, 22 `frozen`. | `business-workspace.registry.ts` | M |
| **G2.3** | Kısmi modüller: `business-purchase`, `business-production-work-orders`, `business-logistics`, `business-quality` — modül `core` ama içindeki menü ögelerinin bir kısmı `frozen`. Ögе seviyesinde de `scope` gerekiyor. | aynı dosya | M |
| **G2.4** | Navigasyon üreticisi `frozen` ögeyi **hiç üretmesin**; rota çözücü (`BusinessWorkspaceRouteHost`) `frozen` rotayı kabul etmesin, kapsam dışı sayfaya yönlendirsin. | `business-workspace.navigation.ts`, `modules/BusinessWorkspaceRouteHost.tsx`, `App.tsx` | M |
| **G2.5** | Test: dondurulmuş bir rota (`ai-analysis`) doğrudan çağrıldığında render etmiyor; menüde `core` olmayan hiçbir öge yok. | `navigation/scope.test.ts` | S |

**Bitti:** Menüde 24–26 öge var, hepsi açılıyor. Dondurulmuş rota elle çağrılsa bile açılmıyor.

> **Dikkat:** Bu adımda uygulama gözle görülür şekilde küçülecek. Bu beklenen sonuç,
> hata değil. ADR-002 "Sonuçlar" bölümü bunu kabul etmiş durumda.

---

## G3 · Veritabanı ve şema

| # | Görev | Nerede | Boyut | Durum |
|---|-------|--------|-------|-------|
| **G3.1** | ~~Supabase projesi (ADR-005'te gerekçesi). Drizzle + `drizzle-kit` kurulumu, bağlantı, `.env.example`.~~ | `db/`, `drizzle.config.ts` | M | ✅ Supabase kısmı tam. Drizzle **kullanılmadı** — bkz. ADR-005 revizyon notu (2026-08-25): düz SQL migration'lara karar verildi. |
| **G3.2** | Kimlik ve organizasyon tabloları: `tenant`, `company`, `branch`, `app_user`, `role`, `permission`, `role_permission`, `user_branch_access`. Kaynak: mevcut `types.ts`. **Yeniden modellemiyoruz, çeviriyoruz.** | `db/schema/identity.ts` | M | ✅ `0001_kimlik_ve_tenant.sql` |
| **G3.3** | `uom` + `uom_conversion` + seed (kg, g, lt, ml, adet ve dönüşümleri). | `db/schema/uom.ts`, `db/seed/uom.ts` | S | ✅ `0002_birimler.sql` |
| **G3.4** | ADR-001 şeması: `stock_item`, `stock_lot`, `stock_movement`, `lot_genealogy`. DDL'e **birebir** uy — `check` kısıtları, kısmi tekil indeks, `unique(tenant_id, idempotency_key)` dahil. | `db/schema/stock.ts` | L | ✅ `0003_stok_defteri.sql` |
| **G3.5** | Append-only zorlaması: `stock_movement_is_immutable()` trigger + `revoke update, delete`. | `db/migrations/` | S | ✅ `0003_stok_defteri.sql`, `0004`'te I5 testiyle doğrulandı |
| **G3.6** | `stock_balance` ve `stock_lot_balance` görünümleri. | `db/schema/stock.ts` | S | ✅ `0003_stok_defteri.sql` |
| **G3.7** | **Her tabloda** RLS: `enable` + `force` + `tenant_isolation` politikası. `force` unutulursa tablo sahibi muaf kalır — en sık yapılan hata. | `db/migrations/` | M | ✅ 14 tablonun 14'ü, `0000_durum.sql` ile doğrulandı |
| **G3.8** | Migration geri alınabilirlik: her migration'ın `down`'ı yazılı ve en az bir kez çalıştırılmış. | `db/migrations/` | S | ✅ **Kapandı (2026-08-25) — plandışı ama gerçek bir sınama ile.** `db/migrations/geri_alma_0001-0008.sql` yazıldı; Emrah bunu yanlışlıkla **üretim projesinde** çalıştırdı (talimat ayrı bir test projesindeydi — bkz. aşağıdaki not), ardından `0001`→`0008`'i sırayla tekrar çalıştırıp şemayı ve `emrah` yönetici hesabını sıfırdan geri kurdu. Doğrulama sorguları (RLS/force/politika, `anon` kısıtlaması, `app_user`/`tenant`/`company`/`branch` eşleşmesi) restorasyondan önceki hâliyle birebir aynı sonucu verdi — yani "geri al, tekrar kur" döngüsü fiilen bir kez çalıştırılmış ve kanıtlanmış oldu. |

**Bitti:** Boş veritabanına migration'lar sıfırdan uygulanıyor, geri alınıyor, tekrar
uygulanıyor. `stock_movement` satırı elle `UPDATE` denendiğinde veritabanı reddediyor.
**G3 tamamen kapandı.**

> **Üretimde kaza (2026-08-25):** Geri alma script'i "ayrı, boş bir test projesinde dene"
> talimatıyla verilmişti; Emrah bunu üretim projesinde (`MİYOP`, `main`/PRODUCTION dalı)
> çalıştırdı. Gerçek müşteri verisi henüz yoktu (yalnızca bootstrap tenant/firma/şube/admin),
> bu yüzden kayıp sınırlıydı ve `0001`→`0008`'in tekrar çalıştırılmasıyla tam olarak geri
> geldi. Ders: bundan sonra "yalnızca ayrı projede çalıştır" talimatı verilirken hangi
> projenin açık olduğu da adım adım teyit ettirilecek.

---

## G4 · Kimlik doğrulama

> **2026-08-25 güncellemesi:** Bu paket yazıldıktan sonra PLAN.md §8'de "Supabase Auth'a
> geçiyoruz" kararı alındı. Aşağıdaki alt görevlerin bir kısmı bu kararla **gereksiz**
> hale geldi (Supabase kendi hash'ini ve kendi parola sıfırlama akışını yapıyor). Durum
> her satırda ayrı ayrı işaretlendi — liste silinmedi, PLAN.md §2 kural 6 gereği.

| # | Görev | Nerede | Boyut | Durum |
|---|-------|--------|-------|-------|
| **G4.1** | ~~Parola hash: argon2id.~~ | `src/auth/` | M | ❌ **Kapatıldı (2026-08-25, Emrah onayı).** Supabase Auth parolayı zaten kendi tarafında güvenli hashliyor; ayrıca kendi hash sistemimizi kurmuyoruz. Bkz. ADR-005 revizyon notu. |
| **G4.2** | Sunucu tarafı oturum: giriş, çıkış, oturum yenileme, süre dolumu. | `src/auth/` | M | ⬜ Kısmen: Supabase-js istemcisi (`core/supabase.ts`) zaten kendi oturumunu/token yenilemesini tutuyor (`persistSession`, `autoRefreshToken`). Uygulamanın kendi `getCurrentUser()`/`setCurrentUser()` localStorage önbelleği hâlâ ayrı ve eski model — ikisini birleştirmek bu görevin geri kalanı. |
| **G4.3** | ~~Parola sıfırlama akışı (tek kullanımlık, süreli token).~~ | `src/auth/` | M | ❌ **Kapatıldı (2026-08-25, Emrah onayı).** Supabase Auth'un hazır "şifremi unuttum" e-posta akışı kullanılacak; kendi token/süre sistemimiz yazılmıyor. Bkz. ADR-005 revizyon notu. |
| **G4.4** | ~~`storage.ts:5064` — `x.password === password` satırını sil. Düz metin `password` alanını `User` tipinden kaldır.~~ | `storage.ts`, `types.ts` | M | ✅ **Kısmen tam:** satır silindi, `authenticateUser()` artık Supabase Auth + `app_user` eşlemesiyle çalışıyor (bkz. PLAN.md §7). `password` alanı tipten **tamamen silinmedi**, `password?: string` yapıldı — çünkü dondurulmuş `CompanySetupWizard` / `BusinessRegistrationSystem` akışları (ADR-002 kapsam dışı) hâlâ bu alanı kullanıyor. Ayrıca uygulama açılışında düz metin `admin/admin123` tohumlayan `ensureDefaultAdmin()` da bu turda kapatıldı. |
| **G4.5** | Mevcut demo kullanıcıları için tek seferlik hash migration'ı. | `db/seed/` | S | ⬜ Yeniden tanımlanmalı: artık "hash migration" değil, "Users.tsx'ten eklenen personelin Supabase Auth hesabına nasıl kavuşacağı" sorusu. Şu an sadece ilk yönetici (`emrah`) gerçek girişte çalışıyor. |
| **G4.6** | Testler: parola hiçbir yerde düz metin değil · yanlış parola sabit sürede reddediliyor · süresi dolmuş oturum reddediliyor · pasif kullanıcı giremiyor. | `src/auth/auth.test.ts` | M | ✅ Kısmen: `src/auth/authenticateUser.test.ts` — 5 test (yanlış giriş reddi, `app_user` eşleşmesi yoksa oturum kapatma, pasif kullanıcı reddi, başarılı girişte düz metin parola olmadığının kanıtı, rol eşleme). "Sabit sürede reddediliyor" ve "süresi dolmuş oturum" testleri Supabase Auth'un kendi sorumluluğu, ayrıca test edilmedi. |

**Bitti tanımı (güncellendi):** `storage.ts`'te hiçbir okunabilir/karşılaştırılan parola
yok ve ilk yönetici gerçek Supabase Auth ile giriyor — **bu kadarı tamam.** G4.1/G4.2/G4.3/
G4.5'in geri kalanı Emrah'ın G4.1/G4.3 için vereceği karara bağlı, henüz kapanmadı.

---

## G5 · Yetkilendirme

| # | Görev | Nerede | Boyut | Durum |
|---|-------|--------|-------|-------|
| **G5.1** | `PERMISSION_CATALOG` (15 izin) → `permission` tablosuna seed. Kaynak zaten doğru modellenmiş, taşınıyor. | `authorization/permission.service.ts` → `db/seed/permissions.ts` | S | ✅ **Tamamlandı (2026-08-27), `0014_izin_katalogu.sql` + `0015_departman_rolleri.sql`.** Katalog artık kodda değil veritabanında: **32 izin** (17 çekirdek + 15 departman izni) ve **12 rol**. `permission.types.ts` bu katalogun aynasıdır, kaynağı değil. Öncesinde `0001` yalnızca 9 izin seed etmişti; fark, departman ayrımının (depo/üretim/satın alma/muhasebe/sevkiyat) o zaman henüz düşünülmemiş olmasıydı. Çerçevenin tamamı `docs/yetki-cercevesi.md` içinde. |
| **G5.2** | Rol-izin ataması + kullanıcı-şube erişimi tabloya taşınır. | `db/schema/identity.ts` | M | ✅ **Tamamlandı (2026-08-27).** `role_permission` 12 rol için yeniden yazıldı; çoka-çok `user_role` tablosu eklendi (RLS: `authenticated` yalnızca **okuyabilir**, yazma yetkisi geri alındı). Atama tek kapıdan yapılıyor: `public.assign_user_roles(uuid, text[])` — `super_admin` yalnızca super_admin tarafından, `admin` yalnızca super_admin/admin tarafından verilebilir. Ekran: `src/pages/RoleAssignmentPanel.tsx` (Kullanıcılar sayfası içinde). Şube ataması hâlâ ekrandan yapılmıyor — o **Aşama 2**'ye kaldı, bkz. `backlog.md`. |
| **G5.3** | Her API ucunda izin kontrolü. Kontrolsüz uç bırakılmaz — varsayılan **reddet**. | `src/api/` | M | ✅ **Yapıldı, ama planlandığından farklı bir yerde.** MİYOP'ta ayrı bir `src/api/` katmanı yok; istemci doğrudan PostgREST'e konuşuyor. Dolayısıyla "uç" = **tablo**, ve varsayılan-reddet **RLS + sütun bazlı GRANT** ile kuruluyor (`0012_yetki_sertlestirme.sql`): `tenant` ve `app_user` üzerinde tablo düzeyi `insert/update` geri alındı, yalnızca zararsız sütunlar geri verildi. Bu sırada Codex'in kaçırdığı bir **yetki yükseltme** kapatıldı: `app_user.role_code` herhangi bir oturum açmış kullanıcı tarafından yazılabiliyordu, yani herkes kendini admin yapabiliyordu. Uygulama tarafında iki savunma hattı daha var: menü (`workspace-navigation.registry.ts`) ve rota (`BusinessWorkspaceRouteHost.tsx`). ⚠️ Bu ikisi **güvenlik sınırı değildir**, yalnızca arayüz temizliğidir — gerçek sınır RLS'tir. |
| **G5.4** | Testler: personel firma profilini güncelleyemez · kullanıcı kendi rolünü yükseltemez · şube yetkisi olmayan o şubenin verisini göremez. | `src/authorization/*.test.ts` | M | ✅ **Tamamlandı (2026-08-27):** `src/authorization/permission-enforcement.test.ts` ve `role-assignment.test.ts`. Ayrıca giriş akışı **kapalı-arıza** (fail-closed): izin listesi okunamazsa (`null`) giriş reddediliyor; boş liste (`[]`) ise "izni yok" demektir ve girişi engellemez — ikisi bilinçli olarak farklı. |

**Bitti:** ✅ G5.4'teki testler geçiyor. Yetki kontrolü olmayan yazma ucu yok.

> **G5'in asıl çıktısı bir dokümandır:** `docs/yetki-cercevesi.md` — hangi departmanın
> hangi izne sahip olması gerektiğini, 12 rolün her birini ve firma sahibinin sınırını
> (kendi firması içinde her şey, platformun kendisinde hiçbir şey) yazıyor. Yetki
> sorusu geldiğinde tartışılacak yer orasıdır, kod değil.

---

## G6 · Repository sınırı

Migrasyonun asıl mekanizması. Dört adım sırayla, atlanmadan.

| # | Görev | Nerede | Boyut | Durum |
|---|-------|--------|-------|-------|
| **G6.1** | `TenantCtx` tipi. Her repository metodunun **ilk** parametresi. Unutulması derleme hatası olmalı. | `src/core/context.ts` | S | ✅ |
| **G6.2** | `StockRepository` arayüzü — ADR-001 §"Uygulama arayüzü" bölümündeki imzalar birebir. | `src/core/stock/stock.repository.ts` | S | ✅ Ayrıca sözleşme hataları da burada: `DuplicateIdempotencyKeyError`, `MovementAlreadyReversedError`, `ZeroQuantityMovementError`, `LotRequiredError`, `UnknownStockItemError`, `MovementNotFoundError` — iki uygulama da aynı hata tipini fırlatmalı. |
| **G6.3** | ~~`LocalStorageStockRepository`: bugünkü `storage.ts` kodunu arayüzün arkasına **taşı**.~~ | `src/core/stock/stock.localstorage.ts` | L | ✅ **Ama bu bir "taşıma" değil, yeni bir uygulama oldu — aşağıdaki nota bakın.** Ayrıca `src/core/stock/uom.ts` (birim dönüşüm tablosu) ve `src/core/stock/stock-item-lookup.ts` (`StockItemLookup` port'u, aşağıda açıklanıyor). |
| **G6.4** | **Sözleşme testleri**: arayüze karşı, uygulamadan bağımsız. ADR-001 §Değişmezler tablosundaki I1–I12. Bu testler bundan sonraki her şeyin hakemi. | `src/core/stock/stock.contract.suite.ts` | L | 🟡 **11/12.** Testlerin gövdesi 2026-08-27'de `stock.contract.suite.ts`'e taşındı; `stock.contract.test.ts` (LocalStorage) ve `stock.contract.live.test.ts` (canlı Postgres) artık **aynı gövdeyi** koşuyor — kopyalanmış iki test dosyası olsaydı biri güncellenip diğeri unutulabilirdi. Local uygulamaya karşı **11/12** yazıldı: I1-I4, I6-I9, I11, **I12** (2026-08-26 eki — aşağıya bkz.) test edildi. I5 yapısal olarak zaten imkansız (arayüzde öyle bir metot yok, ayrı bir yapısal kayıt var). **Yalnızca I10 açık kaldı** — ADR-001'in kendisi bunu "performans gerektiğinde eklenir" diyerek erteliyor, henüz bir snapshot mekanizması yok. Postgres uygulaması gelince aynı dosya ona karşı da (canlı olarak, G7 ile birlikte) çalıştırılacak. **Codex incelemesi (2026-08-25) geçti**, bulduğu 3 gerçek hata düzeltildi — aşağıdaki nota bakın. `npm run typecheck`/`npm test` ile cihazda doğrulandı (2026-08-26, 76/76 yeşil). |
| **G6.5** | `PostgresStockRepository`: aynı arayüz, aynı testler. | `src/core/stock/stock.postgres.ts` | L | 🟡 Yazıldı, cihazda `npm run typecheck`+`npm test` ile doğrulandı (**76/76 yeşil**, 2026-08-26) + **I12 dahil** genişletilmiş sahte (mock) `SupabaseClient` testi geçti — sorgu kurulumu, Postgres hata kodu (23505/23502/23514) çevirisi ve negatif bakiye politikası doğru. JWT önkoşulu (`0009`) artık üretimde ENABLED (ekran görüntüsüyle teyit edildi). **CANLI DOĞRULAMA TAMAMLANDI (2026-08-28):** `npm run test:live` → `stock.contract.live.test.ts` **28/28 yeşil**. LocalStorage'ın koştuğu gövdenin birebir aynısı, bu sefer gerçek Postgres'e karşı. G6.5 ✅ kapandı — aşağıdaki nota bakın. |
| **G6.6** | Uygulama seçici: ortam değişkeni ile `local` \| `pg`. Tek yerden, tek satırla geri alınabilir. | `src/core/stock/index.ts` | S | ✅ Yazıldı, cihazda `npm run typecheck`+`npm test` ile doğrulandı (2026-08-26, 76/76 yeşil). |

**Bitti:** `npm test` her iki uygulamada da I1–I12'yi geçiriyor. Bayrak `pg` iken uygulama
çalışıyor, `local` iken de çalışıyor.

> **G6.3'te bulunan yanlış varsayım (2026-08-25):** Bu maddenin "bugünkü kodu taşı,
> davranış değiştirme" tanımı incelemede yanlış çıktı. Bugünkü `storage.ts`/`types.ts`
> modeli (`StockItem.currentQty` gerçek, `StockMovement` yalnızca `previousQty`/`nextQty`
> ile sonradan yazılan bir günlük) tam olarak ADR-001'in reddettiği modeldir. İdempotency
> kontrolü, tekil ters kayıt zorunluluğu, append-only zorlaması gibi I1-I12'nin
> gerektirdiği hiçbir şey bugünkü kodda yok (`stockDeduction.ts` zaten tanımlı ama hiç
> çağrılmıyor — ADR-001 bunu baştan tespit etmişti). Bu yüzden `LocalStorageStockRepository`
> bir taşıma değil, ADR-001'e göre **yeni, bağımsız** bir uygulama olarak yazıldı. Legacy
> `ra_stock_movements`/`ra_stock_items` anahtarlarına dokunmadı — kendi ayrı anahtarında
> (`miyop_core_stock_movements_v1`) kendi defterini tutuyor. Legacy stok ekranlarının bu
> depoya bağlanması **Dilim 1**'in işi, G6'nın değil.
>
> **`StockItemLookup` — ADR-001'de olmayan küçük bir ek:** `StockRepository` arayüzü stok
> kartı yönetmiyor, ama I7 (birim dönüşümü) kalemin `base_uom`'unu, I8 (lot zorunluluğu)
> `tracks_lot`'unu bilmek zorunda. `LocalStorageStockRepository` bunu yapıcısına enjekte
> edilen küçük bir `StockItemLookup` port'uyla çözdü (`stock-item-lookup.ts`).
> `PostgresStockRepository`'nin buna ihtiyacı yok, çünkü aynı kontrolü veritabanı
> tetikleyicisi zaten yapıyor. Bu, ADR-001'in yayımladığı sözleşmenin bir parçası değil,
> yalnızca local uygulamanın bir detayı.
>
> **I12 açıktı, artık kapandı (2026-08-26):** ADR-001, negatif bakiye politikasının
> (`allow`/`warn`/`block`) "tenant ayarına göre" davrandığını söylüyordu ama hiçbir
> migration'da bunu tutacak bir sütun yoktu. `db/migrations/0010_negatif_bakiye_politikasi.sql`
> ile kapatıldı — ayrıntı ve tasarım gerekçesi aşağıdaki "I12 kapandı" notunda.
>
> **G6.3 hakkında (orijinal not, artık kısmen geçersiz):** Bu madde "mekanik bir taşıma,
> Codex'e en uygun görev" olarak tanımlanmıştı. Yukarıdaki bulgu nedeniyle öyle çıkmadı;
> yine de mekanik ve tasarım gerektirmeyen kısımları (ör. G6.5 Postgres uygulaması, aynı
> arayüze karşı yazılacağı için) Codex'e uygun kalmaya devam ediyor.
>
> **Codex incelemesi (2026-08-25) — bulunan 3 gerçek hata, düzeltildi:**
>
> 1. `postMovement` yalnızca `quantity === 0`'ı reddediyordu; `NaN`/`Infinity` geçebiliyordu
>    (I6'yı deliyordu). Kontrol `!Number.isFinite(m.quantity)`'yi de kapsayacak şekilde
>    genişletildi, 3 yeni test eklendi.
> 2. `reverseMovement`, `quantityOf`/`ledgerOf`'un aksine `branchId`'ye göre filtre
>    yapmıyordu — aynı tenant içinde başka bir şube diğerinin hareketini ters çevirebilirdi.
>    Filtre eklendi, yeni bir test bunu kilitliyor.
> 3. Sözleşme testlerinde iki zayıflık vardı: I3 testi bakiye sıfırken başlıyordu ("eski
>    değere döner" iddiasını zayıf kanıtlıyordu), I9 testi tenant VE branch'i aynı anda
>    değiştiriyordu (kod tenant filtresini kaybetse bile branch filtresi testi kurtarabilirdi).
>    İkisi de güçlendirildi; I7'ye de `postMovement` üzerinden uçtan uca bir test eklendi
>    (öncekiler yalnızca `convertUom()` yardımcı fonksiyonunu test ediyordu).
>
> Ayrıca: `NewMovement.note` alanı ADR-001'in kod bloğunda yoktu, eklendi (ADR-001 ve
> `stock.repository.ts`'e aynı tarihli not düşüldü). `StockItemLookup`'ın test/geliştirme
> amaçlı `InMemoryStockItemLookup` uygulamasının üretime taşınmaması gerektiği dosyaya
> açıkça yazıldı. Codex ayrıca `npx vitest run` ve `npm run typecheck`'i kendi tarafında
> çalıştırıp temiz geçtiğini doğruladı (düzeltmeler öncesindeki haliyle).
>
> **Yeni bulgu (2026-08-26) — JWT'de `tenant_id` claim'i hiç üretilmiyordu:**
> `PostgresStockRepository` yazılırken fark edildi: `app.current_tenant_id()` (0001)
> `tenant_id`'yi Supabase Auth JWT'sinden okuyor, ama projede bunu JWT'ye YAZAN hiçbir
> mekanizma yoktu (grep ile doğrulandı — sıfır eşleşme). Bu bir güvenlik açığı değil —
> RLS varsayılan kapalı, claim yoksa her şeyi süzüyor — ama gerçek bir işlevsel engel:
> `PostgresStockRepository` canlı Supabase'e karşı bağlansa bile HER sorguda sıfır satır
> görür. `db/migrations/0009_jwt_tenant_claim.sql` bunu kapatan bir "Custom Access Token
> Hook" kuruyor (`app_user.tenant_id`'yi JWT'ye yazıyor); devreye alınması için Supabase
> Dashboard'da bir kerelik, sırsız bir adım gerekiyor (bkz. o dosyanın sonu ve
> `db/migrations/README.md`). Bu adım tamamlanıp `stock.contract.test.ts` gerçekten canlı
> bir Postgres'e karşı (ayrı bir test/scratch projesinde, RLS açıkken) I1-I12'yi geçirene
> kadar G6.5 tam anlamıyla kapanmış sayılmıyor — bugün elimizde olan, doğru yazıldığına
> dair güçlü ama dolaylı kanıt (tip kontrolü + mock testler), canlı kanıt değil.
>
> **G6.6 tasarım notu:** Seçici varsayılan olarak `local`'i seçiyor — env değişkeni
> tanımsız ya da tanınmayan bir değer taşırsa da `local`'e düşüyor. Bilinçli: `postgres`
> modunun üretimde "sessizce boş sonuç" vermesi, yanlışlıkla açık bırakılmış bir bayraktan
> çok daha kötü bir hata sınıfı.
>
> **I12 kapandı (2026-08-26) — `negative_stock_policy`:** ADR-001 I12'yi tanımlıyordu
> ("negatif bakiye politikası tenant ayarına göre") ama hiçbir migration'da bunu tutacak
> bir sütun yoktu. `db/migrations/0010_negatif_bakiye_politikasi.sql`, `tenant` tablosuna
> `negative_stock_policy` (`allow`\|`warn`\|`block`, varsayılan `block`) ekledi. Zorlama
> veritabanı tetikleyicisinde değil — her iki `postMovement()` de (Local ve Postgres)
> hareketten SONRAKİ bakiyeyi hesaplayıp negatifse politikayı okuyor: `block` reddediyor
> (`NegativeBalanceBlockedError`), `warn` kabul edip `Movement.warning`'i dolduruyor
> (kalıcı bir sütun değil, yalnızca yazma anındaki ekran ipucu), `allow` sessizce kabul
> ediyor. **`reverseMovement()` bu kontrolden bilinçli olarak muaf** — I3, I12'den
> önceliklidir (bir ters kaydın reddedilmesi asıl hatayı düzeltilemez bırakırdı). Yeni
> `TenantPolicyLookup` port'u `StockItemLookup` ile aynı desende (`tenant-policy-lookup.ts`);
> `LocalStorageStockRepository`'nin ikinci (opsiyonel) yapıcı parametresi, verilmezse
> güvenli varsayılana (`block`) düşüyor. Hem Local sözleşme testlerine (6 yeni test) hem
> Postgres mock testlerine (5 yeni test) I12 senaryoları eklendi; ayrıca gerçek koda karşı
> 20 senaryoluk manuel bir duman testiyle (vitest kurulamadığı için) ayrıca doğrulandı.
> **Sonuç: I1-I12'den 11'i artık test ediliyor, yalnızca I10 (snapshot mutabakatı) açık
> kaldı** — ADR-001'in kendi tanımına göre bu, bir snapshot mekanizması gerçekten
> gerekene kadar zaten erteleniyor.

> **⚠️ Yukarıdaki "I12 kapandı" notu ERKEN YAZILMIŞTI — ikinci Codex incelemesi
> (2026-08-26) düzeltti.** O nottaki tasarım kararı ("zorlama uygulama katmanındadır,
> çünkü DB kısıtı `warn`/`allow`'u imkansız kılardı") öncülü doğru ama sonucu yanlış
> bir akıl yürütmeydi: bir `check` **kısıtı** politikayı okuyamaz, ama bir
> **tetikleyici** okuyabilir. Üçüncü seçenek hiç düşünülmemişti.
>
> Sonuç olarak I12 aslında bir invariant değildi: `0006` her `authenticated`
> kullanıcıya `stock_movement` üzerinde doğrudan `INSERT` verdiği için kontrol tek bir
> REST çağrısıyla atlanabiliyordu; ayrıca okuma ile yazma arasında TOCTOU yarışı vardı.
> `0011` (tetikleyici + `pg_advisory_xact_lock`) ikisini de kapattı, `0012` politikayı
> kimin değiştirebileceğini sınırladı (aynı kusur `app_user.role_code` üzerinden bir
> yetki yükseltmesine de kapı açıyordu), `0013` JWT hook'unu pasif kullanıcı ve
> askıdaki tenant için kapattı. Tam liste ve gerekçeler: `PLAN.md` §"Codex incelemesi
> kapandı".
>
> **I12 artık canlıda KANITLANDI (2026-08-26):** `db/migrations/i12_canli_sinama.sql`
> üretim projesinde koşuldu, **4/4 geçti** — uygulamayı tamamen devre dışı bırakıp
> doğrudan veritabanına yazarak: (1) `+10` kabul, (2) `-15` **`MI012` ile reddedildi**,
> (3) `-10` (bakiye tam 0) kabul, (4) ters kayıt bakiyeyi −10'a düşürmesine rağmen
> kabul. Sınama defterde hiçbir iz bırakmaz — sonunda bilerek istisna fırlatıp işlemi
> geri alır, çünkü `stock_movement` append-only olduğu için oraya yazılan bir sınama
> hareketi bir daha silinemezdi. `npm run typecheck` temiz, `npm test` **83/83**.
>
> Bu, Dilim 0'da **hem uygulanmış hem canlıda kanıtlanmış ilk invariant**. Diğerleri
> (I1-I9, I11) hâlâ yalnızca LocalStorage/mock seviyesinde doğrulanmış durumda; canlı
> **G6.5 KAPANDI (2026-08-28) — ve kapanırken iki hata yakaladı.**
>
> Aynı sözleşme gövdesi canlı Postgres'e karşı koşuldu: **28/28 yeşil.** Ama ilk
> koşumda değil. İlk koşumda **19 test birden** düştü:
>
> 1. **`invalid input syntax for type uuid: "g7-test"`** — canlı zemini kurarken
>    `ctx.userId` alanına düz bir metin konmuştu. `postMovement` onu
>    `stock_movement.created_by` sütununa yazıyor ve orası `app_user`'a bağlı bir
>    `uuid`. LocalStorage bunu **yakalayamazdı**: orada `created_by` yalnızca bir JSON
>    alanı, tip denetimi yok. Yani bu, ancak gerçek veritabanına karşı koşarak
>    görülebilecek bir hataydı. "İki uygulamada da aynı suite geçsin" maddesinin neden
>    gerçek bir değeri olduğunun somut kanıtı — madde işaretlendiği gün işini yaptı.
> 2. **`JWT issued at future`** — kod hatası değil, saat kayması. Jetonu Auth sunucusu
>    basıyor, doğrulamayı veritabanı yapıyor; iki saat birkaç saniye kayınca jeton
>    "gelecekte düzenlenmiş" sayılıp reddediliyor. `signedInClient` artık **yalnızca bu
>    hataya özgü** kısa bir yeniden deneme yapıyor (5 deneme × 1,5 sn). Başka hiçbir hata
>    yutulmuyor — aksi hâlde gerçek bir arızayı gizlerdik. Ayrıca `fileParallelism: false`.
>
> Defter silinemediği için (`stock_movement` append-only) "temiz zemin" burada silmekle
> değil, **her teste taze bir stok kalemi vererek** sağlanıyor; bakiye kaçınılmaz olarak
> 0'dan başlıyor. Idempotency anahtarları koşuma özgü önek taşıyor, yoksa ikinci koşum
> I2'ye takılır ve testler yanlış sebepten kırılırdı.

---

## G7 · Kabul

| # | Görev | Boyut | Durum |
|---|-------|-------|-------|
| **G7.1** | İzolasyon kabul testi: iki tenant kur, A'nın verisini B'nin oturumuyla **her yoldan** çekmeye çalış — arayüz, API, doğrudan ID. Ayrıca ham SQL ile de dene. | M | ✅ **12/12 yeşil** (2026-08-27). Ayrı `miyop-g7-test` projesi, iki gerçek Auth hesabı, JWT hook etkin. Üretime tek satır yazılmadı. `src/core/tenant-isolation.live.test.ts` |
| **G7.2** | RLS politikası geçici olarak kapatıldığında testlerin **kırmızıya döndüğünü** doğrula. Dönmüyorsa test izolasyonu ölçmüyor demektir. | S | ✅ RLS kapalı → **9 kırmızı**, açık → **12/12 yeşil**. Negatif kontrol, testin kendisinde bir yanlış pozitif de buldu (bkz. `PLAN.md`). |
| **G7.3** | Hata takibi kur (Sentry veya dengi). Pilotta bir şey kırıldığında müşteriden önce sen bileceksin. | S | ⬜ Yapılmadı. Pilot öncesi zorunlu, demo öncesi değil. |
| **G7.4** | `PLAN.md` güncelle: Dilim 0 ✅, Dilim 1 → sıradaki. | S | 🟡 Dilim 0 henüz ✅ değil — G6.4'te **I10** açık, G7.3 açık. |
| **G7.5** | *(plan dışı, eklendi)* Sözleşme gövdesini tek dosyaya al ve **canlı Postgres'e karşı** koş. | M | ✅ **28/28 yeşil** (2026-08-28). `src/core/stock.contract.live.test.ts` + `vitest.live.config.ts`. Kurulum: `docs/g7-kurulum.md` |

---

## Paralel yürütülebilirler

- **G1** ve **G2** birbirinden bağımsız.
- **G3** başladıktan sonra **G6.1–G6.4** paralel gidebilir (arayüz ve localStorage
  uygulaması veritabanını beklemez).
- **G4** ve **G5**, G3.2 bittikten sonra paralel.
- **G6.5** yalnızca G3 ve G6.4 bittikten sonra.

---

## Bu dilimde YAPILMAYACAKLAR

Bunlar Dilim 0'a sızma eğilimi en yüksek işlerdir. Hiçbiri yapılmaz:

- ❌ Mal kabul / üretim / sevkiyat ekranlarına dokunmak — Dilim 2, 3, 4
- ❌ `stock_movement` şemasına yeni alan eklemek — önce ADR
- ❌ Dondurulmuş bir modülü "küçük bir düzeltme" ile açmak
- ❌ Dashboard'u güzelleştirmek — defter dolmadan gösterecek gerçek rakam yok
- ❌ Yeni bir tasarım geçişi — arayüz şu hâliyle yeterince iyi
- ❌ Kapsam dışı ekranların TypeScript hatalarını tek tek düzeltmek — donmuş kod
  derlemeden çıkarılır, düzeltilmez

Aklına gelen her iyi fikir: `docs/backlog.md`. Silinmiyor, bekliyor.
