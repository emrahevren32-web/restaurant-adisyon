-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 3 / Üretim ve izlenebilirlik
-- 0023 — Sevkiyat
--
-- Yol haritası maddeleri:
--   "Sevkiyat → stok çıkışı"              → Sevk edilen lot kaydediliyor
--   "İleri izleme: bu lot nereye gitti"   → Etkilenen sevkiyatlar ve müşteriler
--   "Geri izleme: bu sevkiyatın içinde ne var"
--   "Tek tuşla geri çağırma listesi + PDF"
--
-- ── ZİNCİRİN SON HALKASI ─────────────────────────────────────────────────
-- Buraya kadar zincir içeri doğruydu: mamul ← iş emri ← hammadde ← tedarikçi.
-- Sevkiyat zinciri DIŞARI açar: mamul → müşteri. Geri çağırma tam olarak bu
-- iki yönün birleşimidir:
--
--   "Şu tedarikçi partisi bozuk çıktı" → hangi mamullere girdi → hangi
--   sevkiyatlara gitti → hangi müşterileri aramalıyız
--
-- ── SEVK EDİLEN LOT NEREDE SAKLANIYOR ────────────────────────────────────
-- `shipment_line` tablosunda lot kolonu YOKTUR ve olmayacaktır. Sevk edilen
-- parti DEFTERDE durur: `stock_movement.lot_id`, `source_id = shipment.id`.
--
-- Satırda da tutsaydık iki gerçek olurdu ve FEFO bir çıkışı iki lota böldüğünde
-- (ki bölüyor) satır hangisini yazacağını bilemezdi. Defter ikisini de yazar.
-- Kriterin "sevk edilen lot kaydediliyor" cümlesi bu yüzden karşılanıyor —
-- belgede değil, defterde.
--
-- ── MÜŞTERİ NEDEN SADECE BİR AD ──────────────────────────────────────────
-- Yeni çekirdekte müşteri kartı henüz yok (Aşama 4/5 işi). Geri çağırmanın
-- ihtiyaç duyduğu tek şey "kimi arayacağız" — o da bir ad ve bir telefon.
-- Kart geldiğinde buraya `customer_id` eklenir, ad kolonu denetim izi olarak
-- kalır: sevkiyat anındaki unvan sonradan değişse bile belgede duran değişmez.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists shipment (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  -- Sevkiyat bir DEPODAN çıkar: şubelidir.
  branch_id      uuid not null references branch(id) on delete restrict,
  shipment_no    text not null,

  -- Kime gitti. Geri çağırmada aranacak olan budur.
  customer_name  text not null check (btrim(customer_name) <> ''),
  customer_phone text,
  address        text,

  -- Şubeler arası sevkiyatta hedef şube. Müşteriye giden sevkiyatta boş.
  destination_branch_id uuid references branch(id) on delete restrict,

  -- DRAFT     — hazırlanıyor, deftere HİÇBİR ŞEY yazılmadı
  -- SHIPPED   — mal çıktı, defterde SHIPMENT_OUT hareketleri var
  -- CANCELLED — ters kayıtlarla geri alındı; hareketler SİLİNMEDİ
  status         text not null default 'DRAFT'
                   check (status in ('DRAFT','SHIPPED','CANCELLED')),

  shipped_on     date,
  shipped_at     timestamptz,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint shipment_no_unique unique (tenant_id, shipment_no)
);

create index if not exists shipment_tenant_ix   on shipment (tenant_id, branch_id, status);
create index if not exists shipment_customer_ix on shipment (tenant_id, customer_name);
create index if not exists shipment_date_ix     on shipment (tenant_id, shipped_on);

create table if not exists shipment_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  shipment_id    uuid not null references shipment(id) on delete cascade,
  line_no        integer not null,
  stock_item_id  uuid not null references stock_item(id) on delete restrict,

  -- Sevk edilecek miktar. Hangi LOTTAN gideceğini burası bilmez — FEFO
  -- karar verir ve defter yazar (yukarıdaki nota bakınız).
  qty            numeric(18,6) not null check (qty > 0),
  uom            text not null references uom(code),

  note           text,
  constraint shipment_line_no_unique unique (shipment_id, line_no)
);

create index if not exists shipment_line_ship_ix on shipment_line (shipment_id);
create index if not exists shipment_line_item_ix on shipment_line (stock_item_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['shipment','shipment_line'] loop
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
grant select, insert, update on shipment to authenticated;
grant select, insert, update, delete on shipment_line to authenticated;
-- Sevkiyat SİLİNMEZ, iptal edilir: geri çağırma listesi geçmişe bakar.
revoke all privileges on shipment, shipment_line from anon;

drop trigger if exists shipment_touch on shipment;
create trigger shipment_touch before update on shipment
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
where c.relname in ('shipment','shipment_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('shipment','shipment_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) SEVK EDİLEN LOT: `shipment_line` içinde lot kolonu OLMAMALI.
--    Sevk edilen parti defterde durur (`stock_movement.lot_id`).
--    Aşağıdaki sorgu BOŞ dönmeli.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'shipment_line'
  and column_name like '%lot%';
