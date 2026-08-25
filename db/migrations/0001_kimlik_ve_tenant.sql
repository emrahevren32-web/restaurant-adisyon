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
