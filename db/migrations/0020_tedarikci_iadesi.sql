-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 2 / Depo çekirdeği
-- 0020 — Tedarikçiye iade
--
-- Yol haritası maddesi: "Kısmi kabul, ret ve iade"
--
-- ── RET İLE İADE AYNI ŞEY DEĞİLDİR ───────────────────────────────────────
-- Bu ayrım ürünün en çok karıştırılan noktalarından biri ve şemayı da o
-- belirliyor:
--
--   RET  — mal KAPIDA reddedildi. Depoya hiç girmedi.
--          → `goods_receipt_line.rejected_qty` içinde durur.
--          → Deftere HİÇ yazılmaz. Girmemiş mal stok değildir; yazmak,
--            hiç sahip olunmamış malı bir an için sahip olunmuş göstermek olurdu.
--
--   İADE — mal KABUL EDİLDİ, depoya girdi, sonra geri gönderiliyor.
--          (Sonradan bozuk çıktı, yanlış ürün, fazla gönderim…)
--          → Bu tablo.
--          → Deftere ÇIKIŞ hareketi olarak yazılır (`PURCHASE_RETURN`).
--
-- Kısmi kabul ise ayrı bir belge değil, mal kabulün doğal hâli: sipariş 200,
-- gelen 180. `goods_receipt_line.accepted_qty` bunu zaten taşıyor.
--
-- ── NEDEN KABUL SATIRINA BAĞLI ───────────────────────────────────────────
-- İade "hangi maldan" değil, "hangi PARTİDEN" yapılır. Kabul satırına bağlamak
-- şu soruları tek sorguyla cevaplanabilir kılıyor:
--   • Bu tedarikçiden aldığımız malın yüzde kaçını iade ettik?
--   • Bu partiden kaç kez iade çıktı?
-- Serbest bir iade kaydı bu soruların hiçbirini cevaplayamazdı.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists supplier_return (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  branch_id    uuid not null references branch(id) on delete restrict,
  return_no    text not null,
  -- Hangi kabulden iade ediliyor. Zorunlu: iade her zaman bir girişin
  -- geri dönüşüdür.
  receipt_id   uuid not null references goods_receipt(id) on delete restrict,
  supplier_id  uuid not null references supplier(id) on delete restrict,
  returned_on  date not null default current_date,
  -- İade nedeni belge seviyesinde: tedarikçiyle konuşulacak asıl konu budur.
  reason       text not null,
  note         text,
  status       text not null default 'DRAFT'
                 check (status in ('DRAFT','POSTED','CANCELLED')),
  posted_at    timestamptz,
  created_by   uuid references app_user(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint supplier_return_no_unique unique (tenant_id, return_no),
  constraint supplier_return_reason_not_blank check (btrim(reason) <> '')
);

create table if not exists supplier_return_line (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id) on delete restrict,
  return_id         uuid not null references supplier_return(id) on delete cascade,
  -- Hangi kabul satırının iadesi.
  receipt_line_id   uuid not null references goods_receipt_line(id) on delete restrict,
  stock_item_id     uuid not null references stock_item(id) on delete restrict,
  qty               numeric(18,6) not null check (qty > 0),
  uom               text not null references uom(code),
  -- Lot izleyen kalemde hangi partiden çıkacağı. Boşsa FEFO uygulanır —
  -- ama iadede FEFO genellikle yanlıştır: iade edilen parti BELLİDİR.
  lot_code          text,
  -- Deftere düşen ÇIKIŞ hareketi.
  stock_movement_id uuid references stock_movement(id) on delete restrict,
  line_no           integer not null,
  constraint supplier_return_line_no_unique unique (return_id, line_no)
);

create index if not exists supplier_return_tenant_ix  on supplier_return (tenant_id, branch_id, status);
create index if not exists supplier_return_receipt_ix on supplier_return (receipt_id);
create index if not exists supplier_return_line_ix    on supplier_return_line (return_id);
-- "Bu kabul satırından toplam ne kadar iade edildi" sorgusu için.
create index if not exists supplier_return_line_rl_ix on supplier_return_line (receipt_line_id);

-- ── Kiracı yalıtımı (ADR-004) ─────────────────────────────────────────────
do $$
declare v_tablo text;
begin
  foreach v_tablo in array array['supplier_return','supplier_return_line']
  loop
    execute format('alter table %I enable row level security', v_tablo);
    execute format('alter table %I force  row level security', v_tablo);
    execute format('drop policy if exists %I on %I', v_tablo || '_tenant_isolation', v_tablo);
    execute format(
      'create policy %I on %I using (tenant_id = app.current_tenant_id()) '
      || 'with check (tenant_id = app.current_tenant_id())',
      v_tablo || '_tenant_isolation', v_tablo
    );
  end loop;
end $$;

-- ── Tablo izinleri ────────────────────────────────────────────────────────
-- RLS ile GRANT iki ayrı kapıdır (0017'de unutulmuştu).
grant select, insert, update on supplier_return, supplier_return_line to authenticated;
grant delete on supplier_return_line to authenticated;
revoke all privileges on supplier_return, supplier_return_line from anon;

drop trigger if exists supplier_return_touch on supplier_return;
create trigger supplier_return_touch before update on supplier_return
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
where c.relname in ('supplier_return','supplier_return_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('supplier_return','supplier_return_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) Zincir: iade satırı hem KABUL SATIRINA hem DEFTERE bağlanabilmeli.
select conname, confrelid::regclass as hedef
from pg_constraint
where conrelid = 'supplier_return_line'::regclass and contype = 'f'
order by conname;
