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
