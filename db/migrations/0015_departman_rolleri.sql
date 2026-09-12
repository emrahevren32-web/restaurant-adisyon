-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Aşama 1 — Departman rolleri ve çoklu rol
-- 0015 — Rol çerçevesi
--
-- Emrah'ın talebi (2026-08-27):
--   "personel izinleri personele göre değişmeli. çeşitli roller olmalı ve
--    oluşturulan her personel için roller tiklenmeli ona göre de hareket
--    kabiliyeti olmalı. Firma sahibi ise firması kapsamında benim işimi
--    bozamayacak derecede herşeyi yapabilmeli."
--
-- Bu migration üç şey yapıyor:
--   1. Kataloğu departman izinleriyle 17 → 32'ye çıkarır
--   2. Endüstriyel mutfak departmanlarına karşılık gelen 11 rol tanımlar
--   3. `user_role` ile ÇOKLU rol atamasını mümkün kılar (tiklenebilir roller)
--      ve atamayı yetki kontrollü bir RPC'nin arkasına alır
--
-- İnsan tarafındaki tam çerçeve: docs/yetki-cercevesi.md
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Departman izinleri ────────────────────────────────────────────────
-- Eski katalog departman ayrımı için fazla kabaydı: `business-purchase`
-- `finance.read`'e, `business-recipe` + `business-production-work-orders` +
-- `business-quality`'nin ÜÇÜ BİRDEN `operations.read`'e bağlıydı. Bu yüzden
-- "kalite sorumlusu üretim ekranlarını görmesin" gibi bir ayrım kurulamıyordu.
insert into permission (code, module_code, description) values
  ('purchase.read',    'purchase',   'Satın alma taleplerini ve siparişlerini görüntüleme'),
  ('purchase.write',   'purchase',   'Satın alma talebi/siparişi oluşturma ve tedarikçi yönetimi'),
  ('production.read',  'production', 'Üretim iş emirlerini görüntüleme'),
  ('production.write', 'production', 'Üretim iş emri açma, yürütme ve tüketim yazma'),
  ('recipe.read',      'recipe',     'Reçeteleri görüntüleme'),
  ('recipe.write',     'recipe',     'Reçete oluşturma ve güncelleme'),
  ('quality.read',     'quality',    'Kalite kayıtlarını, lot ve izlenebilirliği görüntüleme'),
  ('quality.write',    'quality',    'Kalite kaydı girme, geri çağırma başlatma'),
  ('logistics.read',   'logistics',  'Sevkiyat ve irsaliyeleri görüntüleme'),
  ('logistics.write',  'logistics',  'Sevkiyat yürütme ve irsaliye kesme'),
  ('branch.read',      'branch',     'Şube listesini ve bilgilerini görüntüleme'),
  ('branch.manage',    'branch',     'Şube oluşturma, güncelleme ve yetkilendirme'),
  ('roles.manage',     'roles',      'Rol tanımlarını ve rol-izin eşlemesini yönetme'),
  ('settings.manage',  'settings',   'İşletme genel ayarlarını değiştirme'),
  ('audit.read',       'audit',      'İşlem geçmişini (audit) görüntüleme')
on conflict (code) do nothing;

-- ── 2. Departman rolleri ─────────────────────────────────────────────────
insert into role (code, name, description) values
  ('isletme_sahibi',        'İşletme Sahibi',        'Kendi işletmesi kapsamında tam yetki. Platform yönetimi HARİÇ.'),
  ('isletme_muduru',        'İşletme Müdürü',        'Tüm operasyon. Kullanıcı, rol ve işletme ayarları HARİÇ.'),
  ('depo_sorumlusu',        'Depo Sorumlusu',        'Stok ve sevkiyat yürütür; satın alma ve üretimi görür.'),
  ('satinalma_sorumlusu',   'Satın Alma Sorumlusu',  'Satın alma ve tedarikçi yürütür; stoğu görür.'),
  ('uretim_sorumlusu',      'Üretim Sorumlusu',      'Üretim ve reçete yürütür; stok düşer, kaliteyi görür.'),
  ('kalite_sorumlusu',      'Kalite Sorumlusu',      'Kalite ve izlenebilirlik yürütür; üretim/stoğu görür, değiştirmez.'),
  ('sevkiyat_sorumlusu',    'Sevkiyat Sorumlusu',    'Sevkiyat ve irsaliye yürütür; stoğu görür.'),
  ('muhasebe',              'Muhasebe',              'Finans yürütür; satın alma ve stoğu görür, operasyona dokunmaz.'),
  ('izleyici',              'Görüntüleyici',         'Her şeyi görür, hiçbir şeyi değiştiremez. Denetçi/danışman için.')
on conflict (code) do nothing;

-- Mevcut iki rolün adı netleştiriliyor (kodları geriye uyumluluk için AYNI kalıyor:
-- `app_user.role_code` bunlara işaret ediyor ve `authenticateUser` 'admin'i
-- 'Admin'e çeviriyor — kod değişirse Emrah'ın hesabı Personel'e düşerdi).
update role set
  name        = 'Platform Sahibi (Yönetici)',
  description = 'Bugünkü Emrah hesabı. Tüm izinler, platform dahil. Bkz. docs/yetki-cercevesi.md'
where code = 'admin';

update role set
  name        = 'Operasyon Personeli',
  description = 'Mutfak/depo personeli. Stok ve üretim yürütür, yönetmez.'
where code = 'personel';

-- ── 3. Rol → izin eşlemesi ───────────────────────────────────────────────
delete from role_permission
where role_code in (
  'super_admin','admin','personel','isletme_sahibi','isletme_muduru',
  'depo_sorumlusu','satinalma_sorumlusu','uretim_sorumlusu','kalite_sorumlusu',
  'sevkiyat_sorumlusu','muhasebe','izleyici'
);

-- super_admin ve admin: her şey.
-- admin'in platform.* alması bilinçli: bugün tek tenant var ve o hesabın sahibi
-- aynı zamanda platformun sahibi. Müşteri firma sahipleri `isletme_sahibi`
-- rolünü alacak — o rolde platform.* YOK. "Firması kapsamında her şey, benim
-- işimi bozamayacak derecede" tam olarak bu ayrımdır.
insert into role_permission (role_code, permission_code)
select 'super_admin', code from permission;

insert into role_permission (role_code, permission_code)
select 'admin', code from permission;

-- İşletme Sahibi: platform HARİÇ her şey.
insert into role_permission (role_code, permission_code)
select 'isletme_sahibi', code from permission
where code not like 'platform.%';

-- İşletme Müdürü: operasyonun tamamı; kullanıcı/rol/ayar/firma yönetimi HARİÇ.
-- Gerekçe: müdür işi yürütür, işletmenin kimliğini ve kimin neye erişeceğini
-- değiştirmez. O yetki sahiptedir.
insert into role_permission (role_code, permission_code)
select 'isletme_muduru', code from permission
where code not like 'platform.%'
  and code not in ('users.manage','roles.manage','settings.manage','company.manage');

-- Departman rolleri — açık listeler.
insert into role_permission (role_code, permission_code) values
  -- Depo: stok ve sevkiyat yürütür; ne aldığını ve ne üretileceğini görür.
  ('depo_sorumlusu','dashboard.read'),  ('depo_sorumlusu','stock.read'),
  ('depo_sorumlusu','stock.write'),     ('depo_sorumlusu','logistics.read'),
  ('depo_sorumlusu','logistics.write'), ('depo_sorumlusu','purchase.read'),
  ('depo_sorumlusu','production.read'), ('depo_sorumlusu','quality.read'),
  ('depo_sorumlusu','recipe.read'),     ('depo_sorumlusu','branch.read'),
  ('depo_sorumlusu','products.read'),

  -- Satın alma: talep/sipariş/tedarikçi yürütür; ne kadar stok kaldığını görür.
  ('satinalma_sorumlusu','dashboard.read'), ('satinalma_sorumlusu','purchase.read'),
  ('satinalma_sorumlusu','purchase.write'), ('satinalma_sorumlusu','stock.read'),
  ('satinalma_sorumlusu','branch.read'),    ('satinalma_sorumlusu','products.read'),
  ('satinalma_sorumlusu','finance.read'),

  -- Üretim: iş emri ve reçete yürütür. stock.write VAR — üretim tüketimi ve
  -- çıktısı deftere hareket yazmak zorundadır (ADR-001).
  ('uretim_sorumlusu','dashboard.read'),   ('uretim_sorumlusu','production.read'),
  ('uretim_sorumlusu','production.write'), ('uretim_sorumlusu','recipe.read'),
  ('uretim_sorumlusu','recipe.write'),     ('uretim_sorumlusu','stock.read'),
  ('uretim_sorumlusu','stock.write'),      ('uretim_sorumlusu','quality.read'),
  ('uretim_sorumlusu','products.read'),    ('uretim_sorumlusu','branch.read'),

  -- Kalite: kendi kaydını yazar, başkasının işini DEĞİŞTİRMEZ. Denetleyen taraf
  -- denetlediği veriyi düzeltebiliyorsa denetim anlamını yitirir — bu yüzden
  -- production.write ve stock.write YOK, audit.read VAR.
  ('kalite_sorumlusu','dashboard.read'), ('kalite_sorumlusu','quality.read'),
  ('kalite_sorumlusu','quality.write'),  ('kalite_sorumlusu','stock.read'),
  ('kalite_sorumlusu','production.read'),('kalite_sorumlusu','recipe.read'),
  ('kalite_sorumlusu','logistics.read'), ('kalite_sorumlusu','audit.read'),
  ('kalite_sorumlusu','branch.read'),

  -- Sevkiyat: irsaliye keser, mal çıkışı yazar.
  ('sevkiyat_sorumlusu','dashboard.read'),  ('sevkiyat_sorumlusu','logistics.read'),
  ('sevkiyat_sorumlusu','logistics.write'), ('sevkiyat_sorumlusu','stock.read'),
  ('sevkiyat_sorumlusu','stock.write'),     ('sevkiyat_sorumlusu','quality.read'),
  ('sevkiyat_sorumlusu','branch.read'),     ('sevkiyat_sorumlusu','products.read'),

  -- Muhasebe: parayı yönetir, malı yönetmez. stock.write kasten YOK.
  ('muhasebe','dashboard.read'), ('muhasebe','finance.read'),
  ('muhasebe','finance.write'),  ('muhasebe','purchase.read'),
  ('muhasebe','stock.read'),     ('muhasebe','branch.read'),
  ('muhasebe','audit.read'),     ('muhasebe','company.read'),

  -- Operasyon Personeli: en dar yürütme kümesi. Mal kabul girer, üretim tüketimi
  -- düşer. Fiyat, tedarikçi, kullanıcı, ayar görmez.
  ('personel','dashboard.read'),  ('personel','stock.read'),
  ('personel','stock.write'),     ('personel','production.read'),
  ('personel','production.write'),('personel','recipe.read'),
  ('personel','products.read');

-- Görüntüleyici: TÜM okuma izinleri, hiçbir yazma izni. Denetçi, danışman,
-- mali müşavir gibi "baksın ama dokunmasın" durumları için.
insert into role_permission (role_code, permission_code)
select 'izleyici', code from permission
where (code like '%.read')
  and code not like 'platform.%';

-- ── 4. Çoklu rol: user_role ──────────────────────────────────────────────
-- `app_user.role_code` tek rol tutuyor ve tutmaya devam edecek (birincil rol,
-- geriye uyumluluk). Küçük bir işletmede bir kişi birden çok şapka takar —
-- depo sorumlusu aynı zamanda satın almacı olabilir. Bu tablo onu mümkün kılar.
-- Etkin izin kümesi = birincil rol ∪ buradaki tüm roller (BİRLEŞİM).
create table if not exists user_role (
  tenant_id   uuid not null references tenant(id)   on delete cascade,
  user_id     uuid not null references app_user(id) on delete cascade,
  role_code   text not null references role(code)   on delete restrict,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references app_user(id) on delete set null,
  primary key (user_id, role_code)
);

create index if not exists user_role_tenant_ix on user_role (tenant_id);

alter table user_role enable row level security;
alter table user_role force  row level security;

drop policy if exists user_role_tenant_isolation on user_role;
create policy user_role_tenant_isolation on user_role
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- Okuma serbest (kendi tenant'ı içinde), YAZMA yok: rol ataması yalnızca
-- aşağıdaki RPC üzerinden yapılır. 0012'nin dersi: tabloya doğrudan yazma
-- yetkisi verilirse, RLS satırı korur ama içeriği korumaz — personel kendine
-- `isletme_sahibi` rolü yazabilirdi.
grant select on table user_role to authenticated;
revoke insert, update, delete on table user_role from authenticated;

-- ── 5. Rol atama RPC'si — "benim işimi bozamayacak derecede" ─────────────
-- PostgREST yalnızca `public` şemasındaki fonksiyonları yayınlar, bu yüzden
-- `app` değil `public` şemasında.
create or replace function public.assign_user_roles(
  p_user_id    uuid,
  p_role_codes text[]
)
returns text[]
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_caller_id     uuid;
  v_caller_tenant uuid;
  v_caller_role   text;
  v_target_tenant uuid;
  v_role          text;
begin
  -- Çağıran kim?
  select u.id, u.tenant_id, u.role_code
    into v_caller_id, v_caller_tenant, v_caller_role
  from app_user u
  join tenant t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and t.status = 'Aktif';

  if v_caller_id is null then
    raise exception 'Aktif bir oturum bulunamadı.' using errcode = 'MI403';
  end if;

  -- Çağıran rol atayabilir mi?
  if v_caller_role not in ('super_admin','admin','isletme_sahibi') then
    raise exception 'Rol atamak için işletme sahibi veya yönetici olmalısınız.'
      using errcode = 'MI403';
  end if;

  -- Hedef kullanıcı ÇAĞIRANIN TENANT'INDA mı? Başka bir işletmenin
  -- kullanıcısına rol atanamaz.
  select u.tenant_id into v_target_tenant from app_user u where u.id = p_user_id;
  if v_target_tenant is null or v_target_tenant <> v_caller_tenant then
    raise exception 'Bu kullanıcı sizin işletmenizde değil.' using errcode = 'MI403';
  end if;

  -- Yetki yükseltme kapısı. İşletme sahibi kendi işletmesinde her şeyi
  -- yapabilir AMA platform rollerini dağıtamaz — Emrah'ın işini bozamamasının
  -- teknik karşılığı tam olarak bu üç satır.
  foreach v_role in array coalesce(p_role_codes, array[]::text[]) loop
    if not exists (select 1 from role r where r.code = v_role) then
      raise exception 'Tanımsız rol: %', v_role using errcode = 'MI400';
    end if;

    if v_role = 'super_admin' and v_caller_role <> 'super_admin' then
      raise exception 'super_admin rolünü yalnızca platform yöneticisi atayabilir.'
        using errcode = 'MI403';
    end if;

    if v_role = 'admin' and v_caller_role not in ('super_admin','admin') then
      raise exception 'admin rolünü işletme sahibi atayamaz.' using errcode = 'MI403';
    end if;
  end loop;

  -- Atama tam değişim (replace): gönderilen liste yeni gerçektir.
  delete from user_role where user_id = p_user_id;

  insert into user_role (tenant_id, user_id, role_code, assigned_by)
  select v_caller_tenant, p_user_id, unnest(coalesce(p_role_codes, array[]::text[])), v_caller_id
  on conflict do nothing;

  return coalesce(p_role_codes, array[]::text[]);
end $$;

comment on function public.assign_user_roles(uuid, text[]) is
  'Bir kullanıcının ek rollerini (user_role) topluca değiştirir. Yalnızca aktif '
  'tenant''ın super_admin / admin / isletme_sahibi kullanıcısı çağırabilir; hedef '
  'kullanıcı çağıranın tenant''ında olmalıdır. İşletme sahibi super_admin veya admin '
  'rolü ATAYAMAZ. Bkz. docs/yetki-cercevesi.md';

revoke execute on function public.assign_user_roles(uuid, text[]) from public, anon;
grant  execute on function public.assign_user_roles(uuid, text[]) to authenticated;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- 1) Katalog 32 izin olmalı.
select count(*) as toplam_izin, 32 as beklenen from permission;

-- 2) Rol başına izin sayısı — insan tarafındaki çerçeve docs/yetki-cercevesi.md
select
  r.code                    as rol,
  r.name                    as rol_adi,
  count(rp.permission_code) as izin_sayisi
from role r
left join role_permission rp on rp.role_code = r.code
group by r.code, r.name
order by count(rp.permission_code) desc, r.code;

-- 3) İşletme sahibi platform iznini ALMAMALI — bu sorgu HİÇ SATIR DÖNDÜRMEMELİ.
select role_code, permission_code as isletme_sahibinde_olmamali
from role_permission
where role_code = 'isletme_sahibi' and permission_code like 'platform.%';

-- 4) Görüntüleyicide tek bir yazma izni OLMAMALI — bu da HİÇ SATIR DÖNDÜRMEMELİ.
select permission_code as izleyicide_olmamali
from role_permission
where role_code = 'izleyici'
  and (permission_code like '%.write' or permission_code like '%.manage');
