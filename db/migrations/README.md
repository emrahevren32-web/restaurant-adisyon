# Veritabanı migration'ları

Sıra önemlidir. Her dosyanın **içeriğini** Supabase → SQL Editor'e yapıştırıp çalıştır.
Dosya adını değil, içindekini.

| # | Dosya | Ne yapar |
|---|-------|----------|
| 0 | `0000_durum.sql` | Durum kontrolü. Hiçbir şey değiştirmez, ne kurulduğunu listeler. |
| 1 | `0001_kimlik_ve_tenant.sql` | Tenant, firma, şube, kullanıcı, rol, izin + RLS |
| 2 | `0002_birimler.sql` | Ölçü birimleri, dönüşüm tablosu ve dönüşüm fonksiyonu |
| 3 | `0003_stok_defteri.sql` | Stok kartı, lot, hareket defteri, lot soyağacı + RLS |
| 4 | `0004_dogrulama.sql` | Şemayı sınar, sonuçları tablo olarak döndürür. **Veri bırakmaz.** |
| 5 | `0005_referans_tablolari.sql` | Referans tablolarına okuma politikası |
| 6 | `0006_yetkiler.sql` | Rollere GRANT + görünüm güvenliği (`security_invoker`) |
| 7 | `0007_anon_kisitlama.sql` | `anon` rolünü müşteri verisinden tamamen çıkarır |
| 8 | `0008_ilk_yonetici.sql` | İlk tenant/firma/şube/yönetici hesabını oluşturur |
| 9 | `0009_jwt_tenant_claim.sql` | Custom Access Token Hook — `tenant_id`'yi JWT'ye yazar (G6) |
| 10 | `0010_negatif_bakiye_politikasi.sql` | `tenant.negative_stock_policy` sütunu — I12 |
| 11 | `0011_negatif_bakiye_zorlamasi.sql` | I12'yi veritabanında **zorlar** (tetikleyici + advisory lock) |
| 12 | `0012_yetki_sertlestirme.sql` | `tenant`/`app_user` üzerindeki geniş UPDATE yetkisini kapatır |
| 13 | `0013_jwt_hook_sertlestirme.sql` | JWT hook'u pasif kullanıcı / askıdaki tenant için kapatır |
| 14 | `0014_izin_katalogu.sql` | İzin kataloğunu tabloya taşır (17 izin) |
| 15 | `0015_departman_rolleri.sql` | Departman rolleri, çoklu rol (`user_role`), rol atama RPC'si |

### G7 sınama dosyaları (üretimde ÇALIŞTIRILMAZ)

| Dosya | Ne yapar |
|---|---|
| `g7_1_sema.sql` | 0001-0015'in birleştirilmiş hâli — sınama projesine tek seferde kurar |
| `g7_2_veri.sql` | İki kiracılı sınama verisi (TESTA 111 kg · TESTB 222 kg) |
| `g7_rls_kapat.sql` | Negatif kontrol: RLS'i kapatır. ⛔ Üretimde ASLA. |
| `g7_rls_ac.sql` | RLS'i geri açar (`enable` + `force`) |

Kullanım sırası ve adım adım kurulum: `docs/g7-kurulum.md`

## 0011-0013 neden var — Codex incelemesi (2026-08-26)

Üçü de bağımsız bir incelemenin bulduğu gerçek açıkları kapatıyor. Özet:

- **0011** — I12 (negatif bakiye engeli) yalnızca uygulama kodundaydı. Ama `0006`
  her `authenticated` kullanıcıya `stock_movement` üzerinde doğrudan `INSERT`
  veriyor, yani kontrol tek bir REST çağrısıyla atlanabiliyordu; ayrıca okuma ile
  yazma arasında TOCTOU yarışı vardı (iki terminal aynı bakiyeyi okuyup ikisi de
  geçebiliyordu). `0010`'un "veritabanına konamaz, `warn`/`allow` imkansız olurdu"
  gerekçesi yanlıştı: bir `check` kısıtı politikayı okuyamaz ama bir **tetikleyici**
  okuyabilir ve yalnızca `block` için reddedebilir. `0011` tam olarak bunu yapıyor,
  TOCTOU'yu da `pg_advisory_xact_lock` ile kapatıyor.
- **0012** — `0006`'daki `grant select, insert, update on tenant, ..., app_user`
  satırı, RLS satırları süzse de **sütunları** süzmüyordu. Sonuç iki yetki
  yükseltmesi: sıradan bir kullanıcı `tenant.negative_stock_policy`'yi `allow`
  yapıp I12'yi kapatabiliyor, daha kötüsü `app_user.role_code`'unu `admin` yapıp
  yönetici olabiliyordu. `0012` tablo seviyesi `UPDATE`'i kaldırıp yalnızca zararsız
  sütunlara kolon seviyesi izin veriyor. **Sıra önemli:** PostgreSQL'de tablo
  seviyesi bir GRANT varken tek bir sütunu REVOKE etmek işe yaramaz.
- **0013** — `0009`'daki hook yalnızca `auth_user_id` eşleşmesine bakıyordu. Pasife
  alınmış bir kullanıcı ve askıya alınmış bir tenant, jeton yenilendikçe `tenant_id`
  claim'ini almaya devam ediyordu. Uygulamanın giriş ekranı pasif kullanıcıyı
  reddediyor, ama elinde refresh token'ı olan biri uygulamayı hiç açmadan jeton
  yenileyebilir. `0013` şartı jetonu basan yere taşıyor ve eşleşme yoksa claim'i
  **açıkça siliyor**.

`0013` için Dashboard adımını tekrarlamana gerek yok — hook zaten kayıtlı, `0013`
yalnızca fonksiyonun gövdesini değiştiriyor. Değişiklik yeni basılan jetonlara
yansır; açık oturumlar bir sonraki yenilemede (ya da çıkış/giriş ile) etkilenir.

Hepsi tekrar çalıştırılabilir (idempotent). `0000` ve `0004`'ü istediğin zaman koşabilirsin.
`0006`/`0007` de güvenli şekilde tekrar çalıştırılabilir; `postgres` süper kullanıcısı olduğu
için Supabase SQL Editor'den çalıştırılırken RLS'i atlar ama GRANT/REVOKE her seferinde
aynı sonucu verir.

## Geri alma (down) betiği — G3.8

`geri_alma_0001-0008.sql`, 0001-0008'in oluşturduğu her şeyi (0006/0007'nin GRANT
sertleştirmesi hariç — bkz. dosyanın başındaki not) siler. **Üretim projesinde
çalıştırılmaz.** Tek amacı, "bu migration'lar geri alınabilir mi" iddiasını ayrı,
boş bir Supabase projesinde bir kez kanıtlamaktır:

1. supabase.com'da yeni, ayrı bir proje aç (ücretsiz katman yeterli).
2. O projenin SQL Editor'ünde `0001` → `0008` dosyalarını sırayla çalıştır
   (aynı dosyalar, sadece yeni projeye karşı).
3. `geri_alma_0001-0008.sql`'i çalıştır. Sondaki doğrulama sorgusu 0 satır dönmeli.
4. `0001` → `0008`'i tekrar sırayla çalıştır. Hatasız bitmeli — bu, şemanın
   gerçekten sıfırdan yeniden kurulabildiğini kanıtlar.
5. Test bitince o projeyi silebilirsin (üretim projene dokunulmadı).

## JWT tenant_id claim'i — 0009 (G6)

`PostgresStockRepository` (G6.5) Supabase Auth'un normal oturum jetonuyla
bağlanır. `app.current_tenant_id()` (0001) bu jetondaki `tenant_id` claim'ini
okur — ama Supabase Auth varsayılan olarak böyle bir claim BASMAZ. `0009`,
bunu üreten bir "Custom Access Token Hook" kurar (`app_user.auth_user_id` →
`app_user.tenant_id` eşlemesiyle).

`0009`'u SQL Editor'de çalıştırmak YETMEZ — fonksiyonu kurar ama devreye
almaz. Devreye almak için BİR KEZ, Dashboard'da (sırsız):

**Authentication → Hooks → "Customize Access Token (JWT) Claims hook" →
Enable → Postgres Function → şema `app`, fonksiyon `custom_access_token_hook`
→ Save.**

Sonra: hook yalnızca YENİ basılan jetonları etkiler. Açık oturumu olan
kullanıcı çıkış yapıp tekrar girmeden `tenant_id` claim'ini almaz.

Bu adım tamamlanana kadar `PostgresStockRepository` canlıda her sorguda
sıfır satır görür (RLS "yabancı" sayıp süzer) — güvenlik açığı değil, ama
`VITE_STOCK_REPOSITORY_MODE=postgres`'in üretimde çalışmaması demektir.
Varsayılan mod bu yüzden bilinçli olarak `local`dır (bkz. `src/core/stock/index.ts`).

## Politikasız RLS tuzağı

Supabase projesinde **Enable automatic RLS** açık. Bu iyi bir varsayılan: public
şemasında açılan her tabloda RLS otomatik etkinleşiyor, yani kimse yanlışlıkla
korumasız tablo bırakamıyor.

Ama şu tuzağı beraberinde getiriyor: **politikası olmayan RLS, herkese kapalı
demektir.** `0005` bu yüzden var — `permission`, `role`, `role_permission`,
`uom`, `uom_conversion` tenant'a ait olmadığı için tenant politikası almamıştı
ve politikasız kalmışlardı. Uygulama bağlandığında yetki listesini okuyamaz,
kg'ı grama çeviremezdi.

**Kural:** `0000` çıktısında `politika` sütunu **0** olan hiçbir satır kalmamalı.

## Bilinen sınır

Supabase SQL Editor `postgres` süper kullanıcısı olarak çalışır ve süper kullanıcılar
**RLS'i atlar**. Yani `0004` RLS'i sınayamaz; sınadığı şeyler append-only,
idempotency, ters kayıt, lot zorunluluğu, birim dönüşümü ve merkez şube tekilliğidir.

~~RLS'in gerçekten çalıştığı, Dilim 0 / G7'de ayrı bir rolle ve uygulamanın kendi
bağlantısıyla doğrulanacaktır. Şu an "RLS kuruldu" diyoruz, "RLS kanıtlandı"
demiyoruz.~~

**✅ ARTIK KANITLANDI (2026-08-27 · G7).** Ayrı bir Supabase projesinde
(`miyop-g7-test`) iki gerçek kiracı ve iki gerçek Auth hesabıyla, uygulamanın
kendi bağlantısı üzerinden sınandı: `npm run test:live` → **12/12 yeşil**.
A, B'nin ne kalemini, ne hareketini, ne bakiyesini, ne kullanıcısını, ne firmasını
görebiliyor; B adına yazamıyor da.

**Negatif kontrol de yapıldı** (ADR-004'ün istediği madde): `g7_rls_kapat.sql` ile
RLS kapatıldığında **9 test kırmızıya döndü**, `g7_rls_ac.sql` ile açılınca hepsi
geri yeşil oldu. Yani testler gerçekten izolasyonu ölçüyor.

Kurulum adımları: `docs/g7-kurulum.md`. Ayrıntı ve negatif kontrolün testin
kendisinde bulduğu kusur: `PLAN.md` §"G7 · İki kiracı izolasyonu".

Bu bölümdeki ilk iki paragraf (süper kullanıcının RLS'i atlaması, `0004`'ün RLS'i
sınayamaması) **hâlâ geçerlidir** — SQL Editor'den yapılan doğrulamalar RLS'i
sınamaz. Kanıt, uygulamanın kendi bağlantısıyla koşan canlı testtedir.
