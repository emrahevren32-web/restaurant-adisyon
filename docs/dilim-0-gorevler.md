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

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G3.1** | Supabase projesi (ADR-005'te gerekçesi). Drizzle + `drizzle-kit` kurulumu, bağlantı, `.env.example`. | `db/`, `drizzle.config.ts` | M |
| **G3.2** | Kimlik ve organizasyon tabloları: `tenant`, `company`, `branch`, `app_user`, `role`, `permission`, `role_permission`, `user_branch_access`. Kaynak: mevcut `types.ts`. **Yeniden modellemiyoruz, çeviriyoruz.** | `db/schema/identity.ts` | M |
| **G3.3** | `uom` + `uom_conversion` + seed (kg, g, lt, ml, adet ve dönüşümleri). | `db/schema/uom.ts`, `db/seed/uom.ts` | S |
| **G3.4** | ADR-001 şeması: `stock_item`, `stock_lot`, `stock_movement`, `lot_genealogy`. DDL'e **birebir** uy — `check` kısıtları, kısmi tekil indeks, `unique(tenant_id, idempotency_key)` dahil. | `db/schema/stock.ts` | L |
| **G3.5** | Append-only zorlaması: `stock_movement_is_immutable()` trigger + `revoke update, delete`. | `db/migrations/` | S |
| **G3.6** | `stock_balance` ve `stock_lot_balance` görünümleri. | `db/schema/stock.ts` | S |
| **G3.7** | **Her tabloda** RLS: `enable` + `force` + `tenant_isolation` politikası. `force` unutulursa tablo sahibi muaf kalır — en sık yapılan hata. | `db/migrations/` | M |
| **G3.8** | Migration geri alınabilirlik: her migration'ın `down`'ı yazılı ve en az bir kez çalıştırılmış. | `db/migrations/` | S |

**Bitti:** Boş veritabanına migration'lar sıfırdan uygulanıyor, geri alınıyor, tekrar
uygulanıyor. `stock_movement` satırı elle `UPDATE` denendiğinde veritabanı reddediyor.

---

## G4 · Kimlik doğrulama

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G4.1** | Parola hash: argon2id. Kayıt ve giriş yollarının ikisi de hash kullanır. | `src/auth/` | M |
| **G4.2** | Sunucu tarafı oturum: giriş, çıkış, oturum yenileme, süre dolumu. | `src/auth/` | M |
| **G4.3** | Parola sıfırlama akışı (tek kullanımlık, süreli token). | `src/auth/` | M |
| **G4.4** | **`storage.ts:5064` — `x.password === password` satırını sil.** Düz metin `password` alanını `User` tipinden kaldır. Derleme hatası veren her yeri düzelt; hiçbirini `any` ile susturma. | `storage.ts`, `types.ts` | M |
| **G4.5** | Mevcut demo kullanıcıları için tek seferlik hash migration'ı. | `db/seed/` | S |
| **G4.6** | Testler: parola hiçbir yerde düz metin değil · yanlış parola sabit sürede reddediliyor · süresi dolmuş oturum reddediliyor · pasif kullanıcı giremiyor. | `src/auth/auth.test.ts` | M |

**Bitti:** Veritabanı dökümünde hiçbir okunabilir parola yok. G4.6'daki dört test geçiyor.

---

## G5 · Yetkilendirme

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G5.1** | `PERMISSION_CATALOG` (15 izin) → `permission` tablosuna seed. Kaynak zaten doğru modellenmiş, taşınıyor. | `authorization/permission.service.ts` → `db/seed/permissions.ts` | S |
| **G5.2** | Rol-izin ataması + kullanıcı-şube erişimi tabloya taşınır. | `db/schema/identity.ts` | M |
| **G5.3** | Her API ucunda izin kontrolü. Kontrolsüz uç bırakılmaz — varsayılan **reddet**. | `src/api/` | M |
| **G5.4** | Testler: personel firma profilini güncelleyemez · kullanıcı kendi rolünü yükseltemez · şube yetkisi olmayan o şubenin verisini göremez. | `src/authorization/*.test.ts` | M |

**Bitti:** G5.4'teki üç test geçiyor. Yetki kontrolü olmayan API ucu yok.

---

## G6 · Repository sınırı

Migrasyonun asıl mekanizması. Dört adım sırayla, atlanmadan.

| # | Görev | Nerede | Boyut |
|---|-------|--------|-------|
| **G6.1** | `TenantCtx` tipi. Her repository metodunun **ilk** parametresi. Unutulması derleme hatası olmalı. | `src/core/context.ts` | S |
| **G6.2** | `StockRepository` arayüzü — ADR-001 §"Uygulama arayüzü" bölümündeki imzalar birebir. | `src/core/stock/stock.repository.ts` | S |
| **G6.3** | `LocalStorageStockRepository`: bugünkü `storage.ts` kodunu arayüzün arkasına **taşı**. Yeniden yazma, davranışı değiştirme. Uygulama aynen çalışmaya devam etmeli. | `src/core/stock/stock.localstorage.ts` | L |
| **G6.4** | **Sözleşme testleri**: arayüze karşı, uygulamadan bağımsız. ADR-001 §Değişmezler tablosundaki I1–I12. Bu testler bundan sonraki her şeyin hakemi. | `src/core/stock/stock.contract.test.ts` | L |
| **G6.5** | `PostgresStockRepository`: aynı arayüz, aynı testler. | `src/core/stock/stock.postgres.ts` | L |
| **G6.6** | Uygulama seçici: ortam değişkeni ile `local` \| `pg`. Tek yerden, tek satırla geri alınabilir. | `src/core/stock/index.ts` | S |

**Bitti:** `npm test` her iki uygulamada da I1–I12'yi geçiriyor. Bayrak `pg` iken uygulama
çalışıyor, `local` iken de çalışıyor.

> **G6.3 hakkında:** Bu mekanik bir taşıma işidir, tasarım işi değil. Codex'e en uygun
> görev. Kural: davranış değişikliği yok, sadece yer değişikliği. Değiştirmek istediğin
> bir şey görürsen `docs/backlog.md`'ye yaz, dokunma.

---

## G7 · Kabul

| # | Görev | Boyut |
|---|-------|-------|
| **G7.1** | İzolasyon kabul testi: iki tenant kur, A'nın verisini B'nin oturumuyla **her yoldan** çekmeye çalış — arayüz, API, doğrudan ID. Ayrıca ham SQL ile de dene. | M |
| **G7.2** | RLS politikası geçici olarak kapatıldığında testlerin **kırmızıya döndüğünü** doğrula. Dönmüyorsa test izolasyonu ölçmüyor demektir. | S |
| **G7.3** | Hata takibi kur (Sentry veya dengi). Pilotta bir şey kırıldığında müşteriden önce sen bileceksin. | S |
| **G7.4** | `PLAN.md` güncelle: Dilim 0 ✅, Dilim 1 → sıradaki. | S |

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
