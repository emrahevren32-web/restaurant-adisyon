-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Aşama 1 — İzin kataloğu tabloya taşınıyor
-- 0014 — PERMISSION_CATALOG → permission / role_permission
--
-- Yol haritası maddesi: "PERMISSION_CATALOG (15 izin) tablolara taşındı"
-- Bitti sayılır ki: "Yetkisiz uç yok, varsayılan reddet"
--
-- ── DURUM TESPİTİ (2026-08-27) ────────────────────────────────────────────
-- Kod tarafında `src/authorization/permission.service.ts` içinde 15 izinlik
-- sabit bir `PERMISSION_CATALOG` dizisi var. Veritabanında ise `0001` yalnızca
-- 9 izin seed'liyor. İkisi BİRBİRİNDEN HABERSİZ:
--
--   * Yalnızca kodda olan (8): products.read/write, finance.read/write,
--     personnel.read/manage, platform.read/manage
--   * Yalnızca veritabanında olan (2): users.read, users.manage
--   * Ortak (7): dashboard.read, stock.read/write, operations.read/write,
--     company.read/manage
--
-- Dahası, roller de koddan geliyordu: `role.service.ts` içindeki `DEFAULT_ROLES`
-- dizisi, `identity.userType` (SUPER_ADMIN / COMPANY_ADMIN / COMPANY_USER)
-- üzerinden izin veriyordu — `app_user.role_code` sütunu hiç okunmuyordu.
--
-- Bu migration veritabanını TEK KAYNAK yapıyor: katalog 17 izne tamamlanıyor
-- (15 kod + 2 veritabanı), roller `app_user.role_code` ile aynı düzleme
-- oturtuluyor ve eşleme açıkça yeniden yazılıyor.
--
-- Tekrar çalıştırılabilir (idempotent): eşlemeyi silip yeniden kurar, yani
-- her koşumda aynı sonucu verir ve elle eklenmiş sapmaları da düzeltir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Katalog tamamlanıyor (15 kod izni + 2 mevcut = 17) ────────────────
insert into permission (code, module_code, description) values
  ('products.read',     'products',    'Ürün/hizmet kataloğunu görüntüleme'),
  ('products.write',    'products',    'Ürün/hizmet oluşturma ve güncelleme'),
  ('finance.read',      'finance',     'Finans verilerini görüntüleme'),
  ('finance.write',     'finance',     'Finans işlemlerini yönetme'),
  ('personnel.read',    'personnel',   'Personel verilerini görüntüleme'),
  ('personnel.manage',  'personnel',   'Personel süreçlerini yönetme'),
  ('platform.read',     'platform',    'EVREN360 platform bilgilerini görüntüleme'),
  ('platform.manage',   'platform',    'EVREN360 platform yönetim işlemleri')
on conflict (code) do nothing;

-- ── 2. super_admin rolü ──────────────────────────────────────────────────
-- Kod tarafındaki USER_TYPES.SUPER_ADMIN'in veritabanı karşılığı yoktu.
-- Eklenmesi katkısız (additive): mevcut app_user satırları etkilenmez.
insert into role (code, name, description) values
  ('super_admin', 'Platform Yöneticisi', 'EVREN360 platform genelinde tam yetki')
on conflict (code) do nothing;

-- ── 3. Rol → izin eşlemesi AÇIKÇA yeniden kuruluyor ──────────────────────
-- Önce bu üç rolün eşlemesi temizlenir; böylece migration tekrar
-- çalıştırıldığında sonuç her zaman aynıdır ve elle eklenmiş sapmalar silinir.
delete from role_permission where role_code in ('super_admin', 'admin', 'personel');

-- super_admin: platform yüzeyi + firma görünürlüğü.
insert into role_permission (role_code, permission_code) values
  ('super_admin', 'platform.read'),
  ('super_admin', 'platform.manage'),
  ('super_admin', 'company.read'),
  ('super_admin', 'company.manage'),
  ('super_admin', 'users.read'),
  ('super_admin', 'users.manage'),
  ('super_admin', 'dashboard.read');

-- admin: BUGÜN tüm izinleri alır (platform.* dahil).
--
-- Bilinçli ve geçici bir karar: MİYOP şu an tek tenant ve tek yöneticiyle
-- çalışıyor; o yönetici aynı zamanda platformun sahibi. `admin`den platform.*
-- iznini bugün almak, hiçbir güvenlik kazancı sağlamadan Emrah'ın kendi
-- ekranlarını kapatma riski taşırdı. Platform ekranlarının zaten ayrı bir
-- `isPlatformAdmin` kapısı var (App.tsx), yani bu izin tek başına bir yetki
-- yükseltmesi değil.
--
-- `super_admin` / `admin` ayrımı, platform yüzeyi müşteri yüzeyinden gerçekten
-- ayrıştığında (Aşama 4+) anlam kazanacak. O gün burada tek yapılacak şey
-- aşağıdaki iki satırdan platform.* olanları çıkarmaktır.
insert into role_permission (role_code, permission_code)
select 'admin', code from permission;

-- personel: operasyonu yürütür, yönetmez.
--
-- Mutfak personeli mal kabul yazar ve üretim tüketimi düşer — bu yüzden
-- `stock.write` ve `operations.write` VAR. Finans, personel yönetimi, kullanıcı
-- yönetimi, firma ayarları ve platform YOK.
--
-- ⚠️ Bu bir İŞ KARARIDIR, teknik bir karar değil. Emrah'ın onayına sunuldu;
-- personelin neye dokunabileceği değişirse tek değiştirilecek yer burasıdır.
insert into role_permission (role_code, permission_code) values
  ('personel', 'dashboard.read'),
  ('personel', 'stock.read'),
  ('personel', 'stock.write'),
  ('personel', 'operations.read'),
  ('personel', 'operations.write'),
  ('personel', 'products.read'),
  ('personel', 'company.read');

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- 1) Katalog 17 satır olmalı.
select count(*) as toplam_izin, 17 as beklenen from permission;

-- 2) Rol başına izin sayısı. Beklenen: super_admin 7, admin 17, personel 7.
select
  r.code                       as rol,
  r.name                       as rol_adi,
  count(rp.permission_code)    as izin_sayisi
from role r
left join role_permission rp on rp.role_code = r.code
group by r.code, r.name
order by count(rp.permission_code) desc;

-- 3) Kod kataloğundaki 15 iznin HEPSİ tabloda mı? Bu sorgu HİÇ SATIR
--    DÖNDÜRMEMELİ — dönen her satır, kodda olup veritabanında olmayan bir izindir.
select kod_izni as veritabaninda_eksik
from unnest(array[
  'dashboard.read','products.read','products.write','stock.read','stock.write',
  'finance.read','finance.write','personnel.read','personnel.manage',
  'operations.read','operations.write','company.read','company.manage',
  'platform.read','platform.manage'
]) as kod_izni
where not exists (select 1 from permission p where p.code = kod_izni);
