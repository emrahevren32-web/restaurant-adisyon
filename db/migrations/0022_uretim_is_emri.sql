-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 3 / Üretim ve izlenebilirlik
-- 0022 — Üretim iş emri
--
-- Yol haritası maddeleri:
--   "Üretim iş emri açma"           → Yetersiz stokla iş emri başlatılamıyor
--   "Hammadde tüketimi deftere yazıyor" → FEFO ile en yakın SKT'li lot seçiliyor
--   "Mamul girişi + yeni lot oluşumu"   → Verim oranı hesaba katılıyor
--   "Üretim firesi ayrı hareket olarak yazılıyor"
--   "İptal edilen iş emri tüketimi geri alıyor" → Ters kayıtla, silmeyle değil
--
-- ── NE SAKLANIR, NE SAKLANMAZ ────────────────────────────────────────────
-- Bu tablolarda MİKTAR SAKLANMAZ — plan saklanır.
--
--   PLAN     : "350 porsiyon çorba için 17,5 kg mercimek çekilecek."
--              → `work_order_line.planned_qty`. Bir NİYET beyanıdır.
--   GERÇEK   : "17,5 kg mercimek şu lotlardan çekildi."
--              → `stock_movement`, `source_id = work_order.id`. Defterdedir.
--
-- Tüketilen miktarı buraya da yazsaydık iki kaynak doğardı ve biri sessizce
-- eskirdi (ADR-001). Ekran "ne kadar tüketildi" diye sorduğunda deftere bakar.
--
-- ── SOYAĞACININ BÜTÜN SIRRI `source_id` ──────────────────────────────────
-- Ayrı bir "soyağacı" tablosu YOK ve olmayacak. Zincir zaten defterde:
--
--   Bu mamulün içinde ne var?
--     → stock_movement WHERE source_id = <iş emri> AND quantity_base < 0
--       → o hareketlerin lot_id'leri = tüketilen hammadde partileri
--
--   Bu hammadde partisi nereye gitti?
--     → stock_movement WHERE lot_id = <lot> AND quantity_base < 0
--       → o hareketlerin source_id'leri = iş emirleri
--       → o iş emirlerinin çıktı hareketleri = mamul lotları  → tekrarla
--
-- Ayrı bir soyağacı tablosu, defterle senkron kalması gereken ikinci bir
-- gerçek olurdu; bir hareket unutulduğu gün geri çağırma listesi eksik çıkardı.
--
-- ── DURUMLAR ─────────────────────────────────────────────────────────────
--   DRAFT     — plan yazıldı, deftere HİÇBİR ŞEY yazılmadı
--   STARTED   — hammadde tüketildi (defterde çıkışlar var)
--   COMPLETED — mamul girişi yazıldı (defterde giriş var)
--   CANCELLED — ters kayıtlarla geri alındı; hareketler SİLİNMEDİ
--
-- "Yetersiz stokla başlatılamaz" kuralı DRAFT → STARTED geçişindedir:
-- planı yazmak serbesttir (yarın gelecek malla üretim planlanabilir), ama
-- deftere yazmak eldeki mala bağlıdır.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists work_order (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete restrict,
  -- Üretim bir MUTFAKTA olur: iş emri şubelidir. Reçete ise firmanındır (0021).
  branch_id       uuid not null references branch(id) on delete restrict,
  order_no        text not null,

  -- Reçetesiz üretim de meşrudur (tek seferlik iş, deneme partisi). O yüzden
  -- boş bırakılabilir; ama boşsa satırlar elle girilir.
  recipe_id       uuid references recipe(id) on delete restrict,

  output_item_id  uuid not null references stock_item(id) on delete restrict,
  planned_qty     numeric(18,6) not null check (planned_qty > 0),
  output_uom      text not null references uom(code),

  -- İş emri açıldığı andaki verim. Reçete sonradan değişse bile bu iş emrinin
  -- hangi orana göre hesaplandığı belli kalır.
  yield_pct       numeric(6,3) not null default 100
                    check (yield_pct > 0 and yield_pct <= 100),

  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','STARTED','COMPLETED','CANCELLED')),

  planned_on      date,
  started_at      timestamptz,
  completed_at    timestamptz,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint work_order_no_unique unique (tenant_id, order_no)
);

create index if not exists work_order_tenant_ix on work_order (tenant_id, branch_id, status);
create index if not exists work_order_recipe_ix on work_order (recipe_id);
create index if not exists work_order_output_ix on work_order (output_item_id);

create table if not exists work_order_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  work_order_id  uuid not null references work_order(id) on delete cascade,
  line_no        integer not null,
  stock_item_id  uuid not null references stock_item(id) on delete restrict,

  -- Fire payı ve verim DAHİL, depodan çekilecek miktar. Reçeteden ölçeklenerek
  -- hesaplandı ve buraya KOPYALANDI: reçete yarın değişse bile bu iş emrinin
  -- neye göre planlandığı belli kalır.
  planned_qty    numeric(18,6) not null check (planned_qty > 0),
  uom            text not null references uom(code),

  note           text,
  constraint work_order_line_no_unique unique (work_order_id, line_no)
);

create index if not exists work_order_line_wo_ix   on work_order_line (work_order_id);
create index if not exists work_order_line_item_ix on work_order_line (stock_item_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['work_order','work_order_line'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists %I on %I', t || '_tenant_isolation', t);
    execute format(
      'create policy %I on %I using (tenant_id = app.current_tenant_id()) '
      'with check (tenant_id = app.current_tenant_id())',
      t || '_tenant_isolation', t);
  end loop;
end $$;

-- ── İzinler ───────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR. Politika yazmak tabloya erişim vermez.
grant select, insert, update on work_order to authenticated;
grant select, insert, update, delete on work_order_line to authenticated;
-- İş emri SİLİNMEZ, iptal edilir: deftere yazdıklarının izi kalmalı.
-- Satır silinebilir — yalnızca taslak hâldeyken planı düzenlemek için.
revoke all privileges on work_order, work_order_line from anon;

drop trigger if exists work_order_touch on work_order;
create trigger work_order_touch before update on work_order
  for each row execute function app.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) RLS açık, zorlanıyor, politikası var mı?
select c.relname as tablo,
       case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
       case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
       (select count(*) from pg_policies p where p.tablename = c.relname) as politika
from pg_class c
where c.relname in ('work_order','work_order_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('work_order','work_order_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) SOYAĞACI: defterde iş emrine bağlanabilecek alanlar duruyor mu?
--    `source_type` ve `source_id` görünmeli — zincir bunların üzerine kurulu.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'stock_movement'
  and column_name in ('source_type','source_id','lot_id','reverses_movement_id')
order by column_name;
