-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 2 / Depo çekirdeği
-- 0019 — Mal kabul
--
-- Yol haritası maddesi: "Mal kabul → stok girişi"
--          Bitti sayılır ki: "Kabul yapılınca stok kartı ve lot kendiliğinden
--                             oluşuyor"
--
-- ── ZİNCİRİN KAPANDIĞI YER ───────────────────────────────────────────────
-- Bu tablo, ürünün asıl sattığı cümleyi mümkün kılan yerdir:
--   "Şu partiyi bu tedarikçiden aldık, şu tarihte geldi, şu kadarı hâlâ
--    depoda, şu kadarı hangi üretime gitti."
-- Zincir şöyle kapanıyor:
--   talep → sipariş → MAL KABUL → stok hareketi → lot → (üretim, sevkiyat)
--
-- ── SATIRDAKİ EN ÖNEMLİ KOLON: stock_movement_id ─────────────────────────
-- Mal kabul kaydı, stoğun KENDİSİ DEĞİLDİR. Stok yalnızca `stock_movement`
-- defterinde yaşar (ADR-001). Bu kolon, kabul satırı ile deftere düşen
-- hareketi birbirine bağlar ve şu soruyu tek sorguyla cevaplar: "bu kabul
-- gerçekten deftere işlendi mi?"
--
-- Boş bırakılabilir olması KASITLIDIR: kabul kaydı önce açılır, hareket
-- sonra yazılır. Arada bir hata olursa kayıt `DRAFT` kalır ve tekrar
-- denenebilir — hiçbir satır iki kez deftere düşmez, çünkü idempotency
-- anahtarı satır başına sabittir (I2).
--
-- ── NEDEN `rejected_qty` ŞİMDİDEN VAR ────────────────────────────────────
-- Yol haritasının sıradaki maddesi "Kısmi kabul, ret ve iade". Kolonu
-- şimdiden koymak, o maddeyi bir şema göçü değil bir ekran işi hâline
-- getiriyor. Bugün yalnızca kabul edilen miktar kullanılıyor; reddedilen
-- miktar deftere HİÇ yazılmaz — depoya girmemiş mal stok değildir.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists goods_receipt (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  branch_id    uuid not null references branch(id) on delete restrict,
  receipt_no   text not null,
  -- Siparişsiz kabul meşrudur: acil alım, numune, iade dönüşü. Zorunlu
  -- kılmak sahte siparişler doğururdu.
  order_id     uuid references purchase_order(id) on delete restrict,
  supplier_id  uuid not null references supplier(id) on delete restrict,
  received_on  date not null default current_date,
  -- Tedarikçinin irsaliyesi. Bir uyuşmazlıkta aranacak ilk belge budur.
  waybill_no   text,
  note         text,
  status       text not null default 'DRAFT'
                 check (status in ('DRAFT','POSTED','CANCELLED')),
  posted_at    timestamptz,
  created_by   uuid references app_user(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint goods_receipt_no_unique unique (tenant_id, receipt_no)
);

create table if not exists goods_receipt_line (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id) on delete restrict,
  receipt_id        uuid not null references goods_receipt(id) on delete cascade,
  -- Hangi sipariş satırının karşılığı. Boşsa siparişsiz kabuldür.
  order_line_id     uuid references purchase_order_line(id) on delete restrict,
  stock_item_id     uuid not null references stock_item(id) on delete restrict,
  accepted_qty      numeric(18,6) not null default 0 check (accepted_qty >= 0),
  rejected_qty      numeric(18,6) not null default 0 check (rejected_qty >= 0),
  reject_reason     text,
  uom               text not null references uom(code),
  unit_price        numeric(18,4) not null default 0 check (unit_price >= 0),
  -- Lot izleyen kalemlerde zorunlu; uygulama katmanı bunu doğruluyor
  -- (I8 · `stock_lot` tetikleyicisi de veritabanı tarafında zorluyor).
  lot_code          text,
  expires_on        date,
  -- Deftere düşen hareket. Bkz. yukarıdaki not.
  stock_movement_id uuid references stock_movement(id) on delete restrict,
  line_no           integer not null,
  -- Ne kabul ne ret: böyle bir satırın var olma sebebi yok.
  constraint goods_receipt_line_qty_positive check (accepted_qty + rejected_qty > 0),
  constraint goods_receipt_line_no_unique unique (receipt_id, line_no)
);

create index if not exists goods_receipt_tenant_ix   on goods_receipt (tenant_id, branch_id, status);
create index if not exists goods_receipt_order_ix    on goods_receipt (order_id);
create index if not exists goods_receipt_supplier_ix on goods_receipt (supplier_id);
create index if not exists goods_receipt_line_ix     on goods_receipt_line (receipt_id);
-- "Bu sipariş satırından toplam ne kadar kabul edildi" sorgusu için.
create index if not exists goods_receipt_line_order_ix on goods_receipt_line (order_line_id);

-- ── Kiracı yalıtımı (ADR-004) ─────────────────────────────────────────────
do $$
declare v_tablo text;
begin
  foreach v_tablo in array array['goods_receipt','goods_receipt_line']
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
-- RLS ile GRANT iki ayrı kapıdır (0017'de bu unutulmuştu).
grant select, insert, update on goods_receipt, goods_receipt_line to authenticated;
grant delete on goods_receipt_line to authenticated;
revoke all privileges on goods_receipt, goods_receipt_line from anon;

drop trigger if exists goods_receipt_touch on goods_receipt;
create trigger goods_receipt_touch before update on goods_receipt
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
where c.relname in ('goods_receipt','goods_receipt_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('goods_receipt','goods_receipt_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) Zincir kurulu mu? Kabul satırı hem SİPARİŞE hem DEFTERE bağlanabilmeli.
select conname, confrelid::regclass as hedef
from pg_constraint
where conrelid = 'goods_receipt_line'::regclass and contype = 'f'
order by conname;
