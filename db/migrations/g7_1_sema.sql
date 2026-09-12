-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · G7 · ADIM 1/2 — Sınama projesinin şeması
--
-- ⛔ BU DOSYAYI ÜRETİM PROJESİNDE ÇALIŞTIRMA. Yalnızca G7 için açtığın
--    AYRI, BOŞ Supabase projesinde çalıştır.
--
-- Bu dosya 0001-0015 migration'larının birleştirilmiş hâlidir. 0000 ve 0004
-- yalnızca doğrulama sorgusu olduğu için, 0008 ise üretime özgü olduğu için
-- (Emrah'ın kendi Auth UID'sini gömüyor) dahil EDİLMEDİ. 0008'in yerini
-- ADIM 2'deki iki kiracılı sınama verisi alıyor.
--
-- Hepsi tekrar çalıştırılabilir; hata alırsan düzeltip yeniden çalıştırabilirsin.
-- ═══════════════════════════════════════════════════════════════════════════



-- ========================================================================
-- >>> 0001_kimlik_ve_tenant.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G3
-- 0001 — Kimlik, firma, şube, rol ve izin tabloları
--
-- ADR-004: her tabloda RLS açık ve FORCE. Tenant izolasyonu uygulama katmanında
-- değil, veritabanında zorlanır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tenant çözümleme yardımcısı ────────────────────────────────────────────
-- Aktif tenant iki kaynaktan okunabilir:
--   1. JWT claim'i  → uygulama Supabase üzerinden bağlandığında
--   2. oturum ayarı → migration, script ve test doğrudan bağlandığında
-- İkisini tek yerde toplamak, RLS politikalarının her yerde aynı yazılmasını sağlar.

create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', ''),
      nullif(current_setting('app.tenant_id', true), '')
    ),
    ''
  )::uuid
$$;

comment on function app.current_tenant_id() is
  'Aktif tenant kimliği. RLS politikalarının tamamı bunu kullanır. Bkz. ADR-004.';

-- ── Tenant ─────────────────────────────────────────────────────────────────
create table if not exists tenant (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  name         text not null,
  status       text not null default 'Aktif'
               check (status in ('Aktif','Pasif','Askıda','Arşivlendi')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tenant_code_unique unique (code)
);

-- Tenant tablosu kendi tenant'ını taşımaz; satır kendisi tenant'tır.
alter table tenant enable row level security;
alter table tenant force  row level security;

drop policy if exists tenant_self_isolation on tenant;
create policy tenant_self_isolation on tenant
  using      (id = app.current_tenant_id())
  with check (id = app.current_tenant_id());

-- ── Firma ──────────────────────────────────────────────────────────────────
create table if not exists company (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant(id) on delete restrict,
  company_code       text not null,
  company_name       text not null,
  short_name         text,
  legal_name         text,
  tax_office         text,
  tax_number         text,
  phone              text,
  email              text,
  website            text,
  address            text,
  city               text,
  district           text,
  postal_code        text,
  logo_url           text,
  authorized_person  text,
  authorized_title   text,
  authorized_phone   text,
  authorized_email   text,
  primary_sector_id  text,
  -- Merkez şube işaretçisi. Yetkili kaynak budur; branch.is_head_office aynadır.
  -- Bkz. companies/branch-directory.service.ts ve ADR-002.
  default_branch_id  uuid,
  status             text not null default 'Aktif',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  -- Firma kodu ve vergi numarası tanımlayıcıdır: büyük harfe indirgenmiş
  -- hâlleriyle tenant içinde tekil olmalı. Bkz. core/identifier.ts
  constraint company_code_unique     unique (tenant_id, company_code),
  constraint company_tax_number_uniq unique (tenant_id, tax_number)
);

create index if not exists company_tenant_ix on company (tenant_id);

alter table company enable row level security;
alter table company force  row level security;

drop policy if exists company_tenant_isolation on company;
create policy company_tenant_isolation on company
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Şube ───────────────────────────────────────────────────────────────────
create table if not exists branch (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id)  on delete restrict,
  company_id      uuid not null references company(id) on delete restrict,
  code            text not null,
  name            text not null,
  branch_type     text not null default 'sube'
                  check (branch_type in ('merkez','sube','uretim','depo','satis')),
  phone           text,
  email           text,
  address         text,
  city            text,
  district        text,
  postal_code     text,
  manager_name    text,
  is_active       boolean not null default true,
  -- company.default_branch_id'nin aynası. Tek satıra bakarak karar verebilmek için var.
  -- Bir firmada aynı anda yalnızca bir şubede true olabilir (aşağıdaki kısmi indeks).
  is_head_office  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint branch_code_unique unique (tenant_id, company_id, code)
);

create index if not exists branch_tenant_ix  on branch (tenant_id);
create index if not exists branch_company_ix on branch (company_id);

-- Bir firmada en fazla bir merkez şube.
create unique index if not exists branch_single_head_office
  on branch (company_id)
  where is_head_office;

-- Tekrar çalıştırılabilir olmalı: ALTER TABLE ... ADD CONSTRAINT'in
-- "if not exists" hâli yok, o yüzden elle kontrol ediyoruz.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_default_branch_fk'
  ) then
    alter table company
      add constraint company_default_branch_fk
      foreign key (default_branch_id) references branch(id) on delete set null
      not valid;
  end if;
end $$;

alter table branch enable row level security;
alter table branch force  row level security;

drop policy if exists branch_tenant_isolation on branch;
create policy branch_tenant_isolation on branch
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Kullanıcı ──────────────────────────────────────────────────────────────
-- Parola burada TUTULMAZ. Kimlik doğrulama Supabase Auth tarafındadır
-- (auth.users). Bu tablo yalnızca uygulama profilini ve tenant bağını taşır.
-- Bkz. PLAN.md §5 — "Parola hiçbir yerde düz metin saklanmaz."
create table if not exists app_user (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant(id)  on delete restrict,
  company_id         uuid          references company(id) on delete set null,
  auth_user_id       uuid unique,
  username           text not null,
  -- Tanımlayıcı olarak normalleştirilmiş hâli. Tekillik bunun üzerinden kurulur;
  -- 'IBRAHIM' ile 'ibrahim' aynı hesaptır. Bkz. core/identifier.ts
  username_key       text not null,
  full_name          text not null default '',
  phone              text,
  profile_photo_url  text,
  role_code          text not null default 'personel',
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint app_user_username_unique unique (tenant_id, username_key)
);

create index if not exists app_user_tenant_ix on app_user (tenant_id);

alter table app_user enable row level security;
alter table app_user force  row level security;

drop policy if exists app_user_tenant_isolation on app_user;
create policy app_user_tenant_isolation on app_user
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Rol ve izin ────────────────────────────────────────────────────────────
-- İzin kataloğu tenant'a bağlı değildir: ürünün tanımladığı sabit listedir.
-- Kaynak: src/authorization/permission.service.ts
create table if not exists permission (
  code         text primary key,
  module_code  text not null,
  description  text not null default ''
);

create table if not exists role (
  code         text primary key,
  name         text not null,
  is_system    boolean not null default true,
  description  text not null default ''
);

create table if not exists role_permission (
  role_code        text not null references role(code)       on delete cascade,
  permission_code  text not null references permission(code) on delete cascade,
  primary key (role_code, permission_code)
);

-- Kullanıcının hangi şubelere erişebildiği.
create table if not exists user_branch_access (
  tenant_id   uuid not null references tenant(id)   on delete cascade,
  user_id     uuid not null references app_user(id) on delete cascade,
  branch_id   uuid not null references branch(id)   on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create index if not exists user_branch_access_tenant_ix on user_branch_access (tenant_id);

alter table user_branch_access enable row level security;
alter table user_branch_access force  row level security;

drop policy if exists user_branch_access_tenant_isolation on user_branch_access;
create policy user_branch_access_tenant_isolation on user_branch_access
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── İzin kataloğu tohumu ───────────────────────────────────────────────────
insert into permission (code, module_code, description) values
  ('dashboard.read',   'dashboard',          'Kontrol paneli görüntüleme'),
  ('stock.read',       'stock',              'Stok bilgilerini görüntüleme'),
  ('stock.write',      'stock',              'Stok hareketi ve kartlarını yönetme'),
  ('operations.read',  'business-workspace', 'Operasyon ekranlarını görüntüleme'),
  ('operations.write', 'business-workspace', 'Operasyon verilerini yönetme'),
  ('company.read',     'company',            'Firma bilgilerini görüntüleme'),
  ('company.manage',   'company',            'Firma yönetim işlemleri'),
  ('users.read',       'users',              'Kullanıcıları görüntüleme'),
  ('users.manage',     'users',              'Kullanıcı ve yetki yönetimi')
on conflict (code) do nothing;

insert into role (code, name, description) values
  ('admin',    'Yönetici', 'Firma genelinde tam yetki'),
  ('personel', 'Personel', 'Operasyonel görüntüleme ve giriş')
on conflict (code) do nothing;

insert into role_permission (role_code, permission_code)
select 'admin', code from permission
on conflict do nothing;

insert into role_permission (role_code, permission_code) values
  ('personel', 'dashboard.read'),
  ('personel', 'stock.read'),
  ('personel', 'stock.write'),
  ('personel', 'operations.read'),
  ('personel', 'operations.write')
on conflict do nothing;


-- ========================================================================
-- >>> 0002_birimler.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3
-- 0002 — Ölçü birimleri ve dönüşümler
--
-- ADR-001: birim dönüşümü defterin İÇİNDE çözülür. Dönüşüm şemada yoksa
-- aşağıdaki her sayı yanlış olur.
--
-- Dönüşümler tenant'a bağlı DEĞİLDİR: kg→g her yerde 1000'dir. Reçeteye özgü
-- verim (yield) burada değil, üretim iş emrinde tutulur.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists uom (
  code       text primary key,
  name       text not null,
  dimension  text not null check (dimension in ('MASS','VOLUME','COUNT'))
);

create table if not exists uom_conversion (
  from_uom  text not null references uom(code),
  to_uom    text not null references uom(code),
  factor    numeric(18,8) not null check (factor > 0),
  primary key (from_uom, to_uom)
);

comment on table uom_conversion is
  '1 birim from_uom = factor adet to_uom. Her çift iki yönlü olarak kaydedilir.';

insert into uom (code, name, dimension) values
  ('kg',    'Kilogram',  'MASS'),
  ('g',     'Gram',      'MASS'),
  ('ton',   'Ton',       'MASS'),
  ('lt',    'Litre',     'VOLUME'),
  ('ml',    'Mililitre', 'VOLUME'),
  ('adet',  'Adet',      'COUNT'),
  ('koli',  'Koli',      'COUNT'),
  ('tepsi', 'Tepsi',     'COUNT')
on conflict (code) do nothing;

insert into uom_conversion (from_uom, to_uom, factor) values
  ('kg',  'g',   1000),
  ('g',   'kg',  0.001),
  ('ton', 'kg',  1000),
  ('kg',  'ton', 0.001),
  ('ton', 'g',   1000000),
  ('g',   'ton', 0.000001),
  ('lt',  'ml',  1000),
  ('ml',  'lt',  0.001)
on conflict (from_uom, to_uom) do nothing;

-- Aynı birime dönüşüm her zaman 1'dir; sorguların özel durum yazmasına gerek kalmasın.
insert into uom_conversion (from_uom, to_uom, factor)
select code, code, 1 from uom
on conflict (from_uom, to_uom) do nothing;

-- ── Dönüşüm fonksiyonu ─────────────────────────────────────────────────────
-- Boyut uyuşmazlığı sessizce geçilmez: kg'ı litreye çevirmeye çalışan kod
-- yanlış bir sayı üretmek yerine hata alır.
create or replace function app.convert_uom(
  p_qty       numeric,
  p_from_uom  text,
  p_to_uom    text
)
returns numeric
language plpgsql
stable
as $$
declare
  v_factor numeric;
begin
  if p_from_uom = p_to_uom then
    return p_qty;
  end if;

  select factor into v_factor
  from uom_conversion
  where from_uom = p_from_uom and to_uom = p_to_uom;

  if v_factor is null then
    raise exception 'Birim dönüşümü tanımlı değil: % → %', p_from_uom, p_to_uom
      using errcode = 'data_exception';
  end if;

  return p_qty * v_factor;
end $$;

comment on function app.convert_uom(numeric, text, text) is
  'Miktarı hedef birime çevirir. Tanımsız dönüşümde hata verir, tahmin yapmaz.';


-- ========================================================================
-- >>> 0003_stok_defteri.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3
-- 0003 — Stok hareket defteri
--
-- ADR-001'in uygulanmasıdır. Tek cümlelik özeti:
--   stock_movement GERÇEKTİR. Mevcut miktar ondan TÜRETİLİR, saklanmaz.
--
-- stock_item tablosunda current_qty kolonu YOKTUR ve eklenmeyecektir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Stok kartı ─────────────────────────────────────────────────────────────
create table if not exists stock_item (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  branch_id      uuid not null references branch(id) on delete restrict,
  code           text not null,
  code_key       text not null,          -- normalleştirilmiş; tekillik bunun üzerinden
  name           text not null,
  category       text,
  base_uom       text not null references uom(code),  -- defterin birimi
  tracks_lot     boolean not null default false,
  tracks_expiry  boolean not null default false,
  min_qty        numeric(18,6) not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint stock_item_code_unique unique (tenant_id, branch_id, code_key)
);

create index if not exists stock_item_tenant_ix on stock_item (tenant_id, branch_id);

alter table stock_item enable row level security;
alter table stock_item force  row level security;
drop policy if exists stock_item_tenant_isolation on stock_item;
create policy stock_item_tenant_isolation on stock_item
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Lot ────────────────────────────────────────────────────────────────────
create table if not exists stock_lot (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id)     on delete restrict,
  branch_id      uuid not null references branch(id)     on delete restrict,
  stock_item_id  uuid not null references stock_item(id) on delete restrict,
  lot_code       text not null,
  lot_code_key   text not null,
  expires_on     date,
  origin_type    text not null check (origin_type in ('RECEIPT','PRODUCTION','OPENING')),
  origin_id      uuid,
  supplier_name  text,
  created_at     timestamptz not null default now(),
  constraint stock_lot_code_unique unique (tenant_id, stock_item_id, lot_code_key)
);

create index if not exists stock_lot_item_ix   on stock_lot (stock_item_id);
create index if not exists stock_lot_expiry_ix on stock_lot (tenant_id, expires_on)
  where expires_on is not null;

alter table stock_lot enable row level security;
alter table stock_lot force  row level security;
drop policy if exists stock_lot_tenant_isolation on stock_lot;
create policy stock_lot_tenant_isolation on stock_lot
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Hareket defteri ────────────────────────────────────────────────────────
create table if not exists stock_movement (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenant(id)     on delete restrict,
  branch_id             uuid not null references branch(id)     on delete restrict,
  stock_item_id         uuid not null references stock_item(id) on delete restrict,
  lot_id                uuid          references stock_lot(id)  on delete restrict,

  -- Defter birimi, İŞARETLİ: pozitif giriş, negatif çıkış.
  -- Sıfır anlamsızdır; kayıt açılıyorsa bir şey değişmiştir.
  quantity_base         numeric(18,6) not null check (quantity_base <> 0),

  -- Kullanıcının girdiği hâli. Denetim ve ekran için korunur; hesaba girmez.
  quantity_entered      numeric(18,6) not null,
  uom_entered           text not null references uom(code),

  reason                text not null check (reason in (
                          'PURCHASE_RECEIPT','PURCHASE_RETURN',
                          'PRODUCTION_CONSUME','PRODUCTION_OUTPUT','PRODUCTION_WASTE',
                          'SHIPMENT_OUT','SHIPMENT_RETURN',
                          'COUNT_SURPLUS','COUNT_SHORTAGE',
                          'EXPIRY_WRITE_OFF','WASTE',
                          'TRANSFER_IN','TRANSFER_OUT',
                          'OPENING_BALANCE','REVERSAL')),
  source_type           text not null,
  source_id             uuid,

  unit_cost             numeric(18,6),
  currency              char(3),

  reverses_movement_id  uuid references stock_movement(id) on delete restrict,

  -- Çift tıklama ve yeniden gönderim koruması. Anahtarı ÇAĞIRAN üretir
  -- (ör. 'receipt:{id}:line:{id}'), sunucu değil.
  idempotency_key       text not null,

  occurred_at           timestamptz not null,                 -- iş zamanı
  recorded_at           timestamptz not null default now(),   -- sistem zamanı
  created_by            uuid references app_user(id) on delete set null,
  note                  text,

  constraint stock_movement_idempotency_unique unique (tenant_id, idempotency_key)
);

-- Bir hareket yalnızca BİR kez ters çevrilebilir.
create unique index if not exists stock_movement_reversal_once
  on stock_movement (reverses_movement_id)
  where reverses_movement_id is not null;

create index if not exists stock_movement_balance_ix
  on stock_movement (tenant_id, branch_id, stock_item_id, occurred_at);

create index if not exists stock_movement_lot_ix
  on stock_movement (lot_id) where lot_id is not null;

create index if not exists stock_movement_source_ix
  on stock_movement (source_type, source_id);

-- ── Append-only zorlaması ──────────────────────────────────────────────────
-- Uygulama katmanına güvenilmez. Düzeltme = ters kayıt, üstüne yazma değil.
create or replace function app.stock_movement_is_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'stock_movement append-only bir defterdir: UPDATE/DELETE yasak. Düzeltme için ters kayıt oluşturun. (id=%)',
    coalesce(old.id, new.id)
    using errcode = 'restrict_violation';
end $$;

drop trigger if exists stock_movement_no_update on stock_movement;
create trigger stock_movement_no_update
  before update on stock_movement
  for each row execute function app.stock_movement_is_immutable();

drop trigger if exists stock_movement_no_delete on stock_movement;
create trigger stock_movement_no_delete
  before delete on stock_movement
  for each row execute function app.stock_movement_is_immutable();

alter table stock_movement enable row level security;
alter table stock_movement force  row level security;
drop policy if exists stock_movement_tenant_isolation on stock_movement;
create policy stock_movement_tenant_isolation on stock_movement
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

-- ── Lot izleyen kalem, lotsuz hareket alamaz ───────────────────────────────
create or replace function app.stock_movement_requires_lot()
returns trigger
language plpgsql
as $$
declare
  v_tracks_lot boolean;
begin
  select tracks_lot into v_tracks_lot from stock_item where id = new.stock_item_id;

  if v_tracks_lot and new.lot_id is null then
    raise exception 'Bu stok kalemi lot takipli; lot_id olmadan hareket yazılamaz. (stock_item_id=%)',
      new.stock_item_id using errcode = 'not_null_violation';
  end if;

  return new;
end $$;

drop trigger if exists stock_movement_lot_guard on stock_movement;
create trigger stock_movement_lot_guard
  before insert on stock_movement
  for each row execute function app.stock_movement_requires_lot();

-- ── Türetilmiş miktar ──────────────────────────────────────────────────────
-- GERÇEK BURASI DEĞİL, DEFTERDİR. Bunlar defterin okunmuş hâlidir.
create or replace view stock_balance as
  select tenant_id, branch_id, stock_item_id, sum(quantity_base) as qty
  from stock_movement
  group by tenant_id, branch_id, stock_item_id;

create or replace view stock_lot_balance as
  select tenant_id, branch_id, stock_item_id, lot_id, sum(quantity_base) as qty
  from stock_movement
  where lot_id is not null
  group by tenant_id, branch_id, stock_item_id, lot_id;

-- ── Lot soyağacı ───────────────────────────────────────────────────────────
-- Geri çağırmanın tamamı bu tablonun üzerine kurulur. Dilim 5, tek özyinelemeli sorgu.
create table if not exists lot_genealogy (
  tenant_id      uuid not null references tenant(id)    on delete cascade,
  parent_lot_id  uuid not null references stock_lot(id) on delete restrict,
  child_lot_id   uuid not null references stock_lot(id) on delete restrict,
  work_order_id  uuid not null,
  quantity_base  numeric(18,6) not null check (quantity_base > 0),
  created_at     timestamptz not null default now(),
  primary key (parent_lot_id, child_lot_id, work_order_id),
  constraint lot_genealogy_no_self check (parent_lot_id <> child_lot_id)
);

create index if not exists lot_genealogy_child_ix  on lot_genealogy (child_lot_id);
create index if not exists lot_genealogy_tenant_ix on lot_genealogy (tenant_id);

alter table lot_genealogy enable row level security;
alter table lot_genealogy force  row level security;
drop policy if exists lot_genealogy_tenant_isolation on lot_genealogy;
create policy lot_genealogy_tenant_isolation on lot_genealogy
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());


-- ========================================================================
-- >>> 0005_referans_tablolari.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3
-- 0005 — Referans tablolarına okuma politikası
--
-- SORUN: Supabase projesinde "Enable automatic RLS" açık olduğu için, public
-- şemasında açılan HER tabloda RLS otomatik etkinleşiyor. Bu iyi bir varsayılan,
-- ama politikasız RLS = herkese kapalı demektir.
--
-- Beş tablo bundan etkilendi: permission, role, role_permission, uom,
-- uom_conversion. Bunlar tenant'a ait DEĞİLDİR — ürünün sabit referans
-- listeleridir ve her oturum açmış kullanıcı okuyabilmelidir. Politika
-- eklenmezse uygulama ilk isteğinde "izin yok" alır: kullanıcı yetkilerini
-- çözemez, kg'ı grama çeviremez.
--
-- Yazma politikası KASTEN eklenmiyor. Bu tablolar yalnızca migration ile
-- (süper kullanıcı olarak) değişir; uygulama onlara yazamaz.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tablo text;
begin
  foreach v_tablo in array array['permission','role','role_permission','uom','uom_conversion']
  loop
    execute format('alter table %I enable row level security', v_tablo);
    execute format('alter table %I force  row level security', v_tablo);
    execute format('drop policy if exists %I on %I', v_tablo || '_read_all', v_tablo);
    execute format(
      'create policy %I on %I for select using (true)',
      v_tablo || '_read_all', v_tablo
    );
  end loop;
end $$;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
-- Her tablonun RLS durumu ve kaç politikası olduğu. Politikasız RLS'li tablo
-- kalmamalı: "politika" sütunu 0 olan satır, o tabloya kimsenin erişemeyeceği
-- anlamına gelir.
select
  c.relname                                             as tablo,
  case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
  case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politika
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;


-- ========================================================================
-- >>> 0006_yetkiler.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G4
-- 0006 — Rol yetkileri (GRANT) ve görünüm güvenliği
--
-- İKİ AYRI KATMAN, karıştırılmamalı:
--
--   GRANT  → "bu role bu tabloya erişebilir mi?"   (masaya oturma izni)
--   RLS    → "hangi satırları görebilir?"           (tabaktakiler)
--
-- RLS politikası yazmak yetmez; GRANT yoksa PostgreSQL 42501 döndürür.
-- Bağlantı testi tam olarak bunu yakaladı.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;
grant usage on schema app    to anon, authenticated;

grant execute on function app.current_tenant_id()                  to anon, authenticated;
grant execute on function app.convert_uom(numeric, text, text)     to anon, authenticated;

-- ── Referans tabloları: okuma herkese açık ─────────────────────────────────
-- Bunlar ürünün sabit listeleridir (kg, g, lt / izin kodları / rol adları).
-- Müşteri verisi değildir, gizli değildir. Yazma yetkisi KİMSEYE verilmiyor:
-- bu tablolar yalnızca migration ile değişir.
grant select on uom, uom_conversion, permission, role, role_permission
  to anon, authenticated;

-- ── Tenant kapsamlı tablolar: yalnızca oturum açmış kullanıcı ──────────────
-- Satır süzmesini RLS yapar; GRANT sadece kapıyı açar.
-- `anon` bu tabloların hiçbirine erişemez — oturum açmadan müşteri verisi yok.
grant select, insert, update on
  tenant, company, branch, app_user, user_branch_access,
  stock_item, stock_lot, lot_genealogy
  to authenticated;

-- DELETE yetkisi hiçbir tabloda verilmiyor. Silme yerine pasife alma
-- (is_active = false) kullanılır; kayıt kaybolmaz, iz kalır.

-- ── Defter: oku ve ekle, o kadar ───────────────────────────────────────────
-- UPDATE ve DELETE verilmiyor. Tetikleyici zaten reddediyor ama yetkiyi de
-- vermiyoruz: iki bağımsız savunma hattı.
grant select, insert on stock_movement to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GÖRÜNÜM GÜVENLİĞİ — bu bölüm atlanırsa RLS delinir
--
-- PostgreSQL'de görünümler varsayılan olarak SAHİBİNİN yetkileriyle çalışır.
-- Yani `stock_balance` görünümünü sorgulayan bir kullanıcı, altındaki
-- `stock_movement` tablosunun RLS politikasını ATLAR ve TÜM tenant'ların
-- stoklarını görür.
--
-- `security_invoker = on` bunu tersine çevirir: görünüm, onu çağıran
-- kullanıcının yetkileriyle çalışır ve RLS uygulanır.
--
-- Bu, RLS kurulmuş bir sistemde en sık gözden kaçan açıktır.
-- ═══════════════════════════════════════════════════════════════════════════

alter view stock_balance     set (security_invoker = on);
alter view stock_lot_balance set (security_invoker = on);

grant select on stock_balance, stock_lot_balance to authenticated;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
select
  c.relname as nesne,
  case c.relkind when 'r' then 'tablo' when 'v' then 'görünüm' end as tur,
  case
    when c.relkind = 'v' then
      case when 'security_invoker=on' = any(c.reloptions) then 'evet' else 'HAYIR' end
    else '—'
  end as security_invoker,
  coalesce((
    select string_agg(distinct g.grantee, ', ' order by g.grantee)
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = c.relname
      and g.grantee in ('anon','authenticated')
  ), '(yok)') as yetkili_roller
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','v')
order by c.relkind desc, c.relname;


-- ========================================================================
-- >>> 0007_anon_kisitlama.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G4
-- 0007 — `anon` rolünü müşteri verisinden tamamen çıkar
--
-- BULGU: 0006 sonrası yetki tablosunda TÜM tablolarda `anon, authenticated`
-- göründü. Oysa 0006 `anon`'a yalnızca referans tablolarını vermişti.
--
-- Kaynağı: Supabase projesindeki "Automatically expose new tables" ayarı.
-- public şemasında açılan her tabloyu Data API rollerine otomatik açıyor.
-- Yani `tenant`, `company`, `stock_movement` dahil her şeye oturum açmamış
-- istemcinin GRANT'i vardı.
--
-- Şu an veri sızmıyor — RLS satırları süzüyor. Ama bu, koruma tek katmana
-- inmiş demektir. ADR-004'ün tamamı "bir katmanın hatası müşteri verisini
-- açığa çıkarmasın" üzerine kurulu. Politikada yapılacak tek bir yazım hatası,
-- GRANT de varken doğrudan sızıntıya dönerdi.
--
-- Bu yüzden `anon` müşteri verisinden tamamen çıkarılıyor: iki bağımsız
-- savunma hattı geri geliyor.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all privileges on
  tenant, company, branch, app_user, user_branch_access,
  stock_item, stock_lot, stock_movement, lot_genealogy
  from anon;

revoke all privileges on stock_balance, stock_lot_balance from anon;

-- Bundan sonra public şemasında açılacak tablolar da `anon`'a otomatik
-- açılmasın. Referans tablosu gerekirse GRANT'i elle, bilerek verilir.
alter default privileges in schema public revoke all on tables from anon;

-- Referans tabloları açık kalır: ürünün sabit listeleri, müşteri verisi değil.
grant select on uom, uom_conversion, permission, role, role_permission to anon;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
-- Beklenen: yalnızca beş referans tablosunda `anon` görünmeli.
-- Diğer her satırda sadece `authenticated` olmalı.
select
  c.relname as nesne,
  case c.relkind when 'r' then 'tablo' when 'v' then 'görünüm' end as tur,
  coalesce((
    select string_agg(distinct g.grantee, ', ' order by g.grantee)
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = c.relname
      and g.grantee in ('anon','authenticated')
  ), '(yok)') as yetkili_roller,
  case
    when exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'
    ) and c.relname not in ('uom','uom_conversion','permission','role','role_permission')
    then '!! anon erisebiliyor'
    else 'tamam'
  end as durum
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','v')
order by durum desc, c.relname;


-- ========================================================================
-- >>> 0009_jwt_tenant_claim.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — JWT tenant_id claim'i
-- 0009 — Custom Access Token Hook: app_user.tenant_id'yi JWT'ye enjekte eder
--
-- ⚠️ NEDEN GEREKLİ: `app.current_tenant_id()` (bkz. 0001) `tenant_id`'yi iki
-- yerden okur: `request.jwt.claims ->> 'tenant_id'` (Supabase Auth JWT'si) ya
-- da `app.tenant_id` oturum ayarı (migration/test/script bağlantıları için).
-- Uygulama tarafı (`PostgresStockRepository`, G6.5) Supabase Auth'un normal
-- oturum jetonuyla bağlanır — ama bu proje şu ana kadar JWT'ye `tenant_id`
-- YAZAN hiçbir mekanizma kurmamıştı. Sonuç: uygulama canlıda bağlansa bile
-- `app.current_tenant_id()` NULL döner, RLS "yabancı" sayıp HER sorguda sıfır
-- satır döndürür. Bu bir güvenlik açığı DEĞİL (RLS varsayılan kapalı/güvenli
-- taraf) ama gerçek bir işlevsel engel — bu migration'la kapatılıyor.
--
-- Bu dosya yalnızca fonksiyonu ve izinleri kurar. Devreye ALINMASI için
-- Supabase Dashboard'da BİR kerelik, sırsız bir adım gerekir — dosya
-- sonundaki "Dashboard adımı" bölümüne bakın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Hook fonksiyonu ──────────────────────────────────────────────────────
-- Supabase'in "Customize Access Token (JWT) Claims" hook sözleşmesi:
-- `(event jsonb) returns jsonb`, event->>'user_id' çağıran kullanıcının
-- auth.users.id'sidir, event->'claims' o ana kadar biriken claim kümesidir.
-- Resmi örnek public şemasında verilir; bu projede altyapı fonksiyonları
-- `app` şemasında toplandığı için (bkz. 0001, app.current_tenant_id()) aynı
-- yerde tutuyoruz.
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.app_user
  where auth_user_id = (event ->> 'user_id')::uuid
  limit 1;

  claims := event -> 'claims';

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function app.custom_access_token_hook(jsonb) is
  'Supabase Auth "Customize Access Token" hook''u. app_user.tenant_id''yi '
  'JWT''nin tenant_id claim''ine yazar — app.current_tenant_id() (0001) bunu okur.';

-- ── İzinler ──────────────────────────────────────────────────────────────
-- Hook'u YALNIZCA Supabase'in kendi auth sunucusu (supabase_auth_admin)
-- çalıştırabilir. Resmi örnekle birebir aynı desen (bkz. Supabase dokümanı
-- "Customizing Access Token (JWT) Claims").
grant usage on schema app to supabase_auth_admin;

grant execute
  on function app.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute
  on function app.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- app_user'da RLS açık + FORCE (0001). Hook çalıştığı anda JWT henüz
-- basılmadığı için app.current_tenant_id() NULL döner — mevcut
-- app_user_tenant_isolation politikası supabase_auth_admin'i de süzer.
-- Bu yüzden supabase_auth_admin'e ayrı, dar bir okuma izni ve politikası
-- gerekir (yalnızca SELECT, yalnızca bu rol için).
grant select on table public.app_user to supabase_auth_admin;

drop policy if exists app_user_auth_admin_read on public.app_user;
create policy app_user_auth_admin_read on public.app_user
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Fonksiyon kuruldu mu ve izinler doğru mu — veri değiştirmez.
select
  p.proname                                   as fonksiyon,
  n.nspname                                   as sema,
  has_function_privilege('supabase_auth_admin', p.oid, 'execute') as auth_admin_calisirabilir_mi
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname = 'custom_access_token_hook';

-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard adımı (BİR KEZ, sırsız — SQL Editor'de değil, Dashboard'da yapılır)
--
-- 1. Supabase Dashboard → ilgili proje → Authentication → Hooks (Auth Hooks).
-- 2. "Customize Access Token (JWT) Claims hook" bölümünü bul.
-- 3. "Enable hook" aç, tür olarak "Postgres Function" seç.
-- 4. Şema: app  ·  Fonksiyon: custom_access_token_hook  seç.
-- 5. Kaydet.
--
-- ⚠️ Bundan sonra: hook yalnızca YENİ basılan JWT'leri etkiler. Emrah'ın o an
-- açık oturumu varsa (tarayıcıda oturum açmış durumda), tenant_id claim'ini
-- almak için ÇIKIŞ YAPIP TEKRAR GİRİŞ yapması gerekir — mevcut jeton otomatik
-- yenilenmez. Yeni giriş yapan her kullanıcı otomatik olarak claim'i alır.
--
-- Devreye alındıktan sonra hızlı sağlama (tarayıcı konsolunda, oturum açıkken):
--   supabase.auth.getSession().then(s => console.log(
--     JSON.parse(atob(s.data.session.access_token.split('.')[1])).tenant_id
--   ))
-- `undefined` değil, tenant UUID'si basılmalı.
-- ═══════════════════════════════════════════════════════════════════════════


-- ========================================================================
-- >>> 0010_negatif_bakiye_politikasi.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — I12 şeması
-- 0010 — tenant.negative_stock_policy
--
-- ADR-001 I12: "Negatif bakiye politikası (allow/warn/block) tenant ayarına
-- göre davranır." Bu ayarı tutacak bir sütun 0001-0009'un hiçbirinde yoktu —
-- bu migration onu ekliyor. Tekrar çalıştırılabilir: sütun zaten varsa
-- hiçbir şey yapmaz (`add column if not exists`), veri kaybetmez.
--
-- ⛔ BU DOSYANIN İLK HÂLİNDEKİ ŞU İDDİA YANLIŞTI (2026-08-26, Codex incelemesi):
--
--     "Zorlama veritabanı tetikleyicisinde DEĞİL, uygulama katmanındadır.
--      Bu bilinçli bir tercih: veritabanı seviyesinde sert bir `check` kısıtı,
--      'warn' ve 'allow' politikalarını imkansız kılardı."
--
-- Gerekçenin `check` kısmı doğru, çıkarılan SONUÇ yanlıştı. Bir `check` kısıtı
-- gerçekten politikayı okuyamaz — ama bir TETİKLEYİCİ okuyabilir ve yalnızca
-- 'block' politikasında reddedebilir; 'warn'/'allow' hiç etkilenmez.
--
-- Uygulama katmanına bırakılan zorlama ise aslında hiç zorlama değildi:
-- `0006_yetkiler.sql` her `authenticated` kullanıcıya `stock_movement`
-- üzerinde doğrudan INSERT verdiği için kontrol tek bir REST çağrısıyla
-- atlanabiliyordu, ayrıca okuma ile yazma arasında TOCTOU yarışı vardı.
--
-- Bu dosya YERİNDE KALIYOR — sütunu o ekliyor ve üretimde çalıştırıldı.
-- Gerçek zorlama:            0011_negatif_bakiye_zorlamasi.sql
-- Politikayı kim değiştirir: 0012_yetki_sertlestirme.sql
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenant
  add column if not exists negative_stock_policy text not null default 'block'
  check (negative_stock_policy in ('allow', 'warn', 'block'));

comment on column tenant.negative_stock_policy is
  'ADR-001 I12 — postMovement() bakiyeyi negatife düşürecek bir hareketle karşılaşınca: '
  '''allow'' sessizce izin verir, ''warn'' izin verip Movement.warning''i doldurur, '
  '''block'' (varsayılan) hareketi reddeder. Zorlama app.stock_movement_negative_guard() '
  'tetikleyicisindedir (0011); repository katmanındaki kontrol hızlı başarısızlık ve '
  'uyarı metni içindir. Bu sütunu yalnızca app.set_negative_stock_policy() değiştirebilir (0012).';

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Her tenant satırı görünmeli, hepsinde negative_stock_policy dolu (varsayılan 'block').
select code, name, negative_stock_policy from tenant order by code;


-- ========================================================================
-- >>> 0011_negatif_bakiye_zorlamasi.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — I12'nin GERÇEK zorlaması
-- 0011 — Negatif bakiye tetikleyicisi + kesin hata kodları
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26 — iki bulgu):
--
--   BULGU 1 (kritik): 0010'un notu "zorlama uygulama katmanındadır" diyordu.
--   Ama `0006_yetkiler.sql` her `authenticated` kullanıcıya `stock_movement`
--   üzerinde doğrudan INSERT veriyor. Yani I12, repository'ye hiç uğramayan
--   bir REST çağrısıyla, eski bir istemciyle veya hatalı bir kodla TAMAMEN
--   atlanabiliyordu. Uygulama katmanında "zorlanan" bir şey invariant değildir;
--   yalnızca bir öneridir.
--
--   BULGU 2 (yüksek): Uygulama katmanındaki kontrol `quantityOf()` okuması ile
--   `insert` arasında TOCTOU yarışına açıktı. Bakiye 10 iken iki terminal aynı
--   anda -6 yazarsa ikisi de "sonuç 4" hesaplar, defter -2'ye düşerdi. Endüstriyel
--   mutfakta aynı hammaddenin iki istasyondan eşzamanlı düşülmesi olağandır.
--
-- ÇÖZÜM: kontrol veritabanına iniyor. 0010'daki "warn/allow'u korumak için
-- veritabanına konamaz" gerekçesi YANLIŞTI — bir `check` kısıtı gerçekten
-- politikayı okuyamaz, ama bir TETİKLEYİCİ okuyabilir. Tetikleyici politikayı
-- satırdan okur ve YALNIZCA 'block' için reddeder; 'warn'/'allow' etkilenmez.
--
-- TOCTOU aynı tetikleyicide `pg_advisory_xact_lock` ile kapanır: aynı
-- (tenant, şube, kalem) üçlüsüne yazan iki işlem sıraya girer, ikincisi
-- birincinin commit'ini gördükten sonra toplar. Kilit transaction sonunda
-- kendiliğinden bırakılır.
--
-- Tekrar çalıştırılabilir (idempotent): yalnızca `create or replace` ve
-- `drop trigger if exists` kullanır, veri değiştirmez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Negatif bakiye tetikleyicisi (I12) ─────────────────────────────────
create or replace function app.stock_movement_negative_guard()
returns trigger
language plpgsql
as $$
declare
  v_policy      text;
  v_lock_key    bigint;
  v_current_qty numeric(18,6);
  v_result_qty  numeric(18,6);
begin
  -- I3 > I12: ters kayıt bu kontrolden BİLİNÇLİ olarak muaftır. "Ters kayıt
  -- bakiyeyi tam olarak eski değerine döndürür" invariant'ı daha önceliklidir;
  -- bir ters kaydın reddedilmesi asıl hareketi düzeltilemez bırakırdı.
  -- (Uygulama katmanındaki muafiyetle birebir aynı karar.)
  if new.reverses_movement_id is not null then
    return new;
  end if;

  -- Bakiyeyi ARTIRAN hareket negatife düşüremez. Ucuz erken çıkış: sağlıklı
  -- girişlerde ne politika sorgusu ne kilit maliyeti var.
  if new.quantity_base > 0 then
    return new;
  end if;

  -- Politika tenant satırından okunur. Satır yoksa (olmamalı) en güvenli
  -- tarafa düşülür: 'block'.
  select coalesce(t.negative_stock_policy, 'block')
    into v_policy
  from public.tenant t
  where t.id = new.tenant_id;

  v_policy := coalesce(v_policy, 'block');

  -- 'warn' ve 'allow' veritabanı tarafında ENGELLEMEZ. Kullanıcıya gösterilen
  -- uyarı metnini repository üretir (Movement.warning); veritabanının burada
  -- söyleyecek bir sözü yok. Bu erken çıkış, 0010'un "warn/allow imkansız
  -- olurdu" endişesinin neden yersiz olduğunu gösterir.
  if v_policy <> 'block' then
    return new;
  end if;

  -- ── TOCTOU kapanışı ──
  -- Aynı (tenant, şube, kalem) üçlüsüne yazan işlemleri sıraya sokar. Kilit
  -- transaction'a bağlı: commit/rollback ile kendiliğinden bırakılır, ayrıca
  -- serbest bırakma çağrısı gerekmez. Farklı kalemler birbirini beklemez.
  v_lock_key := hashtextextended(
    new.tenant_id::text || '/' || new.branch_id::text || '/' || new.stock_item_id::text,
    0
  );
  perform pg_advisory_xact_lock(v_lock_key);

  -- Toplam AÇIKÇA süzülür (RLS'e güvenilmez): SQL Editor'den süper kullanıcı
  -- olarak çalışıldığında RLS atlanır ve süzülmemiş bir toplam tüm tenant'ları
  -- kapsardı. Açık `where`, hangi rolle çalışıldığından bağımsız doğru sonucu verir.
  select coalesce(sum(m.quantity_base), 0)
    into v_current_qty
  from public.stock_movement m
  where m.tenant_id     = new.tenant_id
    and m.branch_id     = new.branch_id
    and m.stock_item_id = new.stock_item_id;

  v_result_qty := v_current_qty + new.quantity_base;

  if v_result_qty < 0 then
    raise exception
      'Negatif bakiye engellendi (I12): bu hareket bakiyeyi %s yapardı. Tenant politikası: block. (stock_item_id=%)',
      v_result_qty, new.stock_item_id
      using errcode = 'MI012';
  end if;

  return new;
end $$;

comment on function app.stock_movement_negative_guard() is
  'ADR-001 I12 — negatif bakiye politikası zorlaması. Yalnızca ''block'' politikasında '
  've yalnızca bakiyeyi azaltan, ters kayıt OLMAYAN hareketlerde devreye girer. '
  'pg_advisory_xact_lock ile TOCTOU yarışını kapatır. Hata kodu: MI012.';

drop trigger if exists stock_movement_negative_guard on stock_movement;
create trigger stock_movement_negative_guard
  before insert on stock_movement
  for each row execute function app.stock_movement_negative_guard();

-- ── 2. Lot tetikleyicisinin hata kodu kesinleştiriliyor ───────────────────
-- 0003 bu tetikleyiciyi `errcode = 'not_null_violation'` (23502) ile yazmıştı.
-- 23502 GENEL bir koddur: şemadaki herhangi bir not-null ihlali de aynı kodu
-- döndürür. İstemci "23502 gördüm → demek ki lot eksik" diye çevirdiğinde
-- alakasız hataları LotRequiredError olarak yanlış adlandırıyordu (Codex
-- bulgusu). Kendi koduna çekiliyor: MI008.
create or replace function app.stock_movement_requires_lot()
returns trigger
language plpgsql
as $$
declare
  v_tracks_lot boolean;
begin
  select tracks_lot into v_tracks_lot from stock_item where id = new.stock_item_id;

  if v_tracks_lot and new.lot_id is null then
    raise exception 'Bu stok kalemi lot takipli; lot_id olmadan hareket yazılamaz. (stock_item_id=%)',
      new.stock_item_id using errcode = 'MI008';
  end if;

  return new;
end $$;

comment on function app.stock_movement_requires_lot() is
  'ADR-001 I8 — lot takipli kalem lotsuz hareket alamaz. Hata kodu: MI008 '
  '(0003''teki genel 23502 yerine; bkz. 0011 başlığı).';

-- Tetikleyici sırası ADLARINA göredir (PostgreSQL BEFORE tetikleyicileri
-- alfabetik çalıştırır): lot_guard < negative_guard, yani lot kontrolü önce
-- çalışır. İstenen sıra budur — eksik lot, bakiye hesabından önce yakalanmalı.

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- İki tetikleyici de stock_movement üzerinde kurulu ve BEFORE INSERT olmalı.
select
  t.tgname                                   as tetikleyici,
  case t.tgtype::integer & 2 when 2 then 'BEFORE' else 'AFTER' end as zaman,
  case t.tgtype::integer & 4 when 4 then 'INSERT' else 'diğer' end as olay,
  t.tgenabled = 'O'                          as etkin_mi
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'stock_movement'
  and not t.tgisinternal
order by t.tgname;


-- ========================================================================
-- >>> 0012_yetki_sertlestirme.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — Yetki sertleştirme
-- 0012 — tenant ve app_user üzerinde yetki yükseltmesini kapatır
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26):
--
--   `0006_yetkiler.sql` şunu yazıyordu:
--       grant select, insert, update on tenant, company, branch, app_user, ...
--         to authenticated;
--
--   RLS bu tablolarda "hangi SATIRI" görebileceğini süzüyor — ama "hangi
--   SÜTUNU yazabileceğini" süzmüyor. Sonuç, iki gerçek yetki yükseltmesi:
--
--   (a) tenant.negative_stock_policy — sıradan bir kullanıcı doğrudan REST
--       çağrısıyla politikayı 'allow' yapıp I12'yi kendi tenant'ı için
--       kapatabilirdi. (Codex'in doğrudan bulduğu madde.)
--
--   (b) DAHA AĞIRI — Codex'in maddesi buraya kadar gitmiyordu ama aynı kusurun
--       aynı satırdaki devamı: `app_user` üzerindeki UPDATE yetkisi
--       `role_code` sütununu da kapsıyordu. Yani HERHANGİ bir personel
--       kendi satırında `role_code = 'admin'` yazıp yönetici olabilirdi.
--       Aynı şekilde `tenant.status`'u 'Aktif' yapıp askıya alınmış bir
--       tenant kendi askısını kaldırabilirdi. Bunlar tek satırlık REST
--       çağrılarıydı.
--
-- ÇÖZÜM: tablo seviyesi UPDATE kaldırılıyor, yerine YALNIZCA zararsız
-- sütunlara kolon seviyesi UPDATE veriliyor. PostgreSQL'de tablo seviyesi bir
-- GRANT varken tek bir sütunu REVOKE etmek İŞE YARAMAZ (kolon ve tablo
-- yetkileri ayrı tutulur) — bu yüzden önce tablo yetkisi tamamen kaldırılıp
-- sonra istenen sütunlar tek tek veriliyor. Sıra önemlidir.
--
-- Politika değişikliği için yetki kontrollü bir RPC bırakılıyor
-- (`app.set_negative_stock_policy`) — yönetici bunu çağırabilir, personel
-- çağıramaz.
--
-- ✅ KIRILMA RİSKİ İNCELENDİ: `src/` içinde Supabase üzerinden `tenant` veya
-- `app_user` tablosuna YAZAN tek bir çağrı yok (yalnızca `storage.ts:5082`
-- bir SELECT yapıyor — giriş akışı). Bu migration bugünkü hiçbir ekranı
-- bozmaz. Dilim 1'de gerçek kullanıcı yönetimi geldiğinde, kullanıcı
-- oluşturma/rol atama işlemleri bu RPC ile aynı desende yetki kontrollü
-- fonksiyonlar olarak yazılmalıdır — doğrudan tablo INSERT/UPDATE'i ile değil.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. tenant: yalnızca görünen adı değiştirilebilir ──────────────────────
-- code (kimlik), status (askı durumu) ve negative_stock_policy (I12) artık
-- doğrudan yazılamaz. Tenant satırı oluşturmak da platform işidir (bkz. 0008).
revoke insert, update on tenant from authenticated;
grant  update (name, updated_at) on tenant to authenticated;

-- ── 2. app_user: yalnızca kendi profil bilgileri ──────────────────────────
-- role_code, is_active, tenant_id, company_id, username, username_key ve
-- auth_user_id artık doğrudan yazılamaz — yetki yükseltmesinin kapısı buydu.
revoke insert, update on app_user from authenticated;
grant  update (full_name, phone, profile_photo_url, updated_at) on app_user
  to authenticated;

-- ── 3. Politika değişikliği için yetki kontrollü RPC ──────────────────────
-- SECURITY DEFINER: fonksiyon sahibinin yetkileriyle çalışır (RLS'i atlar),
-- bu yüzden yetkilendirmeyi fonksiyonun KENDİSİ yapmak zorundadır. Hedef
-- tenant kullanıcıdan parametre olarak ALINMAZ — çağıranın kendi oturumundan
-- türetilir; böylece başka bir tenant'ın politikasına dokunulamaz.
create or replace function app.set_negative_stock_policy(p_policy text)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  if p_policy is null or p_policy not in ('allow', 'warn', 'block') then
    raise exception 'Geçersiz negatif stok politikası: %. allow, warn veya block olmalı.', p_policy
      using errcode = 'MI400';
  end if;

  select u.tenant_id
    into v_tenant_id
  from public.app_user u
  join public.tenant   t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.role_code = 'admin'
    and t.status    = 'Aktif';

  if v_tenant_id is null then
    raise exception 'Bu işlem için aktif tenant''ta yönetici yetkisi gerekir.'
      using errcode = 'MI403';
  end if;

  update public.tenant
     set negative_stock_policy = p_policy,
         updated_at            = now()
   where id = v_tenant_id;

  return p_policy;
end $$;

comment on function app.set_negative_stock_policy(text) is
  'ADR-001 I12 — tenant negatif stok politikasını değiştirir. Yalnızca aktif tenant''ın '
  'aktif yöneticisi çağırabilir. Hedef tenant çağıranın oturumundan türetilir, '
  'parametre olarak alınmaz. Bkz. 0012 başlığı.';

revoke execute on function app.set_negative_stock_policy(text) from public, anon;
grant  execute on function app.set_negative_stock_policy(text) to authenticated;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- `authenticated` rolünün tenant ve app_user üzerinde HANGİ sütunlarda UPDATE
-- yetkisi kaldığını listeler. Beklenen:
--   tenant   → name, updated_at
--   app_user → full_name, phone, profile_photo_url, updated_at
-- Bu listede role_code, is_active, status veya negative_stock_policy
-- GÖRÜNMEMELİ.
select
  table_name  as tablo,
  column_name as yazilabilir_sutun
from information_schema.column_privileges
where grantee     = 'authenticated'
  and privilege_type = 'UPDATE'
  and table_schema = 'public'
  and table_name in ('tenant', 'app_user')
order by table_name, column_name;

-- Tablo seviyesinde UPDATE/INSERT kalmadığını da doğrula — bu sorgu
-- tenant/app_user için UPDATE veya INSERT satırı DÖNDÜRMEMELİ.
select
  table_name     as tablo,
  privilege_type as kalan_tablo_yetkisi
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('tenant', 'app_user')
  and privilege_type in ('INSERT', 'UPDATE')
order by table_name, privilege_type;


-- ========================================================================
-- >>> 0013_jwt_hook_sertlestirme.sql
-- ========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — JWT hook sertleştirme
-- 0013 — Pasif kullanıcı ve askıya alınmış tenant artık claim almaz
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26):
--
--   0009'daki hook YALNIZCA `auth_user_id` eşleşmesine bakıyordu:
--       select tenant_id from app_user where auth_user_id = ...
--
--   Yani `app_user.is_active = false` yapılmış (işten çıkarılmış) bir kullanıcı
--   ve `tenant.status = 'Askıda'` (ödemesi durmuş) bir tenant, jeton yenilendiği
--   her seferinde `tenant_id` claim'ini almaya DEVAM ediyordu. RLS bu claim'e
--   bakarak satırları açtığı için, pasif kullanıcı doğrudan REST çağrısıyla
--   tenant verisine erişmeyi sürdürebilirdi.
--
--   Uygulamanın giriş kodu (`storage.ts` içindeki `authenticateUser`) pasif
--   kullanıcıyı zaten reddedip oturumu kapatıyor — ama bu YALNIZCA uygulamanın
--   kendi giriş ekranından geçenler için geçerli. Elinde geçerli bir refresh
--   token'ı olan biri uygulamayı hiç açmadan jeton yenileyebilir. Kapı,
--   uygulamada değil, jetonu basan yerde kapatılmalı.
--
-- ÇÖZÜM: hook sorgusu aktif kullanıcı + aktif tenant ile sınırlanıyor ve
-- eşleşme yoksa claim AÇIKÇA siliniyor (`claims - 'tenant_id'`). Açıkça
-- silmek önemli: 0009 eşleşme bulamadığında claim'e hiç dokunmuyordu, yani
-- daha önce basılmış bir claim taşınabilirdi.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  v_tenant_id uuid;
begin
  -- Aktif kullanıcı VE aktif tenant şartı. Herhangi biri sağlanmazsa
  -- v_tenant_id null kalır ve aşağıda claim silinir.
  select u.tenant_id
    into v_tenant_id
  from public.app_user u
  join public.tenant   t on t.id = u.tenant_id
  where u.auth_user_id = (event ->> 'user_id')::uuid
    and u.is_active
    and t.status = 'Aktif'
  limit 1;

  claims := event -> 'claims';

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  else
    -- AÇIKÇA sil. Eşleşme yoksa claim'e "dokunmamak" yetmez: pasife alınmış
    -- bir kullanıcının jetonu yenilenirken eski claim taşınabilirdi.
    claims := claims - 'tenant_id';
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function app.custom_access_token_hook(jsonb) is
  'Supabase Auth "Customize Access Token" hook''u. AKTİF kullanıcının AKTİF tenant''ının '
  'kimliğini JWT''nin tenant_id claim''ine yazar; şartlar sağlanmazsa claim''i siler. '
  'app.current_tenant_id() (0001) bunu okur. Bkz. 0009 (ilk hâli) ve 0013 (sertleştirme).';

-- ── İzinler ──────────────────────────────────────────────────────────────
-- 0009 yalnızca app_user için okuma izni ve politikası vermişti. Sorgu artık
-- `tenant` tablosuna da katılıyor; tenant'ta da RLS açık + FORCE (0001) ve
-- hook çalıştığı anda JWT henüz basılmadığı için app.current_tenant_id() NULL
-- döner — mevcut tenant_self_isolation politikası supabase_auth_admin'i süzer.
-- Bu yüzden aynı desende dar bir okuma izni + politika gerekiyor.
grant select on table public.tenant to supabase_auth_admin;

drop policy if exists tenant_auth_admin_read on public.tenant;
create policy tenant_auth_admin_read on public.tenant
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- 0009'daki app_user izinleri hâlâ gerekli — tekrar çalıştırılabilir olsun
-- diye burada da tekrarlanıyor (aynı sonucu verir).
grant usage  on schema app             to supabase_auth_admin;
grant select on table public.app_user  to supabase_auth_admin;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function app.custom_access_token_hook(jsonb) from authenticated, anon, public;

drop policy if exists app_user_auth_admin_read on public.app_user;
create policy app_user_auth_admin_read on public.app_user
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Hook'un şu an hangi kullanıcılara claim BASACAĞINI gösterir. Pasif kullanıcı
-- veya aktif olmayan tenant satırlarında `claim_alir_mi` false olmalı.
select
  u.username                                        as kullanici,
  u.is_active                                       as kullanici_aktif,
  t.code                                            as tenant,
  t.status                                          as tenant_durumu,
  (u.is_active and t.status = 'Aktif')              as claim_alir_mi
from public.app_user u
join public.tenant   t on t.id = u.tenant_id
order by t.code, u.username;

-- ⚠️ Dashboard adımı TEKRAR GEREKMEZ: hook zaten etkin (0009'da yapıldı) ve
-- aynı şema/fonksiyon adına bakıyor — `create or replace` gövdeyi değiştirir,
-- kaydı değil. Ama değişiklik yalnızca YENİ basılan jetonlara yansır; açık
-- oturumlar bir sonraki jeton yenilemesinde (ya da çıkış/giriş ile) etkilenir.


-- ========================================================================
-- >>> 0014_izin_katalogu.sql
-- ========================================================================

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


-- ========================================================================
-- >>> 0015_departman_rolleri.sql
-- ========================================================================

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
