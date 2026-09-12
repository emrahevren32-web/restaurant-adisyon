-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 2 / Depo çekirdeği
-- 0018 — Satın alma talebi ve siparişi
--
-- Yol haritası maddesi: "Satın alma talebi ve siparişi"
--                       Bitti sayılır ki: "Talep → sipariş akışı uçtan uca"
--
-- ── NEDEN İKİ AYRI TABLO ─────────────────────────────────────────────────
-- Talep ve sipariş aynı şey değildir ve birleştirmek pahalıya patlar:
--
--   TALEP   = "buna ihtiyacım var"    · üretim/mutfak açar · tedarikçi YOK,
--             fiyat YOK, henüz bir taahhüt yok
--   SİPARİŞ = "bunu şundan aldım"     · satın alma açar   · tedarikçi VAR,
--             fiyat VAR, firma taahhüt altına girmiştir
--
-- Kağıtla çalışan işletmede bu ayrım zaten var — mutfak "domates bitti" der,
-- satın alma "kimden, kaça" sorusunu cevaplar. Tek tabloya sıkıştırmak, bu iki
-- soruyu aynı ana bağlamak olurdu: talep açan kişi fiyatı bilmediği için ya
-- boş bırakır ya uydurur.
--
-- Bir talepten birden çok sipariş çıkabilir (üç kalem, üç ayrı tedarikçi) ve
-- bir sipariş taleple hiç ilgili olmayabilir (düzenli alım). Bu yüzden bağ
-- `purchase_order.request_id` üzerinde ve BOŞ BIRAKILABİLİR.
--
-- ── NEDEN SATIRLAR AYRI TABLODA ──────────────────────────────────────────
-- Kalemleri jsonb bir sütuna koymak bugün hızlı olurdu. Ama "bu stok kaleminin
-- geçen yıl kaç siparişi geçti" sorusu — satın alma analitiğinin tamamı — o
-- durumda her satırı ayrıştırmayı gerektirir ve yabancı anahtar kurulamaz:
-- silinmiş bir stok kalemine bağlı sipariş satırı sessizce kalır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Durumlar ──────────────────────────────────────────────────────────────
-- Durumlar METİN + check kısıtı olarak tutuluyor, Postgres `enum` tipi DEĞİL.
-- Enum'a yeni bir değer eklemek ayrı bir migration ve tablo kilidi gerektirir;
-- bu akışın büyüyeceği kesin (kısmi kabul, ret, iade sırada). Check kısıtı ise
-- tek satırla değiştirilir.

-- ── Talep ─────────────────────────────────────────────────────────────────
create table if not exists purchase_request (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete restrict,
  branch_id    uuid not null references branch(id) on delete restrict,
  request_no   text not null,
  status       text not null default 'DRAFT'
                 check (status in ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
  needed_by    date,
  note         text,
  -- Kim açtı ve kim onayladı: onay bir imzadır, kimin attığı bilinmelidir.
  created_by   uuid references app_user(id) on delete set null,
  decided_by   uuid references app_user(id) on delete set null,
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint purchase_request_no_unique unique (tenant_id, request_no)
);

create table if not exists purchase_request_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  request_id     uuid not null references purchase_request(id) on delete cascade,
  stock_item_id  uuid not null references stock_item(id) on delete restrict,
  -- Talep miktarı, TALEP EDİLEN birimde tutulur. Temel birime çevirme işi
  -- siparişte ve mal kabulde yapılır (I7). Mutfak "2 kasa" der, defter kg
  -- tutar; talebi kg'a çevirmeye zorlamak talebi hiç açtırmazdı.
  qty            numeric(18,6) not null check (qty > 0),
  uom            text not null references uom(code),
  note           text,
  line_no        integer not null,
  constraint purchase_request_line_no_unique unique (request_id, line_no)
);

-- ── Sipariş ───────────────────────────────────────────────────────────────
create table if not exists purchase_order (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  branch_id     uuid not null references branch(id) on delete restrict,
  order_no      text not null,
  supplier_id   uuid not null references supplier(id) on delete restrict,
  -- Talepten doğduysa bağ burada. Boş olabilir: düzenli alımlar talep açmadan
  -- doğrudan sipariş edilir ve bunu zorunlu kılmak sahte talepler doğururdu.
  request_id    uuid references purchase_request(id) on delete set null,
  status        text not null default 'DRAFT'
                  check (status in ('DRAFT','SENT','PARTIAL','RECEIVED','CANCELLED')),
  currency      text not null default 'TRY',
  expected_date date,
  note          text,
  created_by    uuid references app_user(id) on delete set null,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint purchase_order_no_unique unique (tenant_id, order_no)
);

create table if not exists purchase_order_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  order_id       uuid not null references purchase_order(id) on delete cascade,
  stock_item_id  uuid not null references stock_item(id) on delete restrict,
  qty            numeric(18,6) not null check (qty > 0),
  uom            text not null references uom(code),
  -- Birim fiyat sipariş anındaki fiyattır ve DEĞİŞMEZ. Ortalama maliyet bundan
  -- hesaplanacak (sıradaki madde); geçmişe dönük fiyat değişikliği maliyeti
  -- sessizce bozardı.
  unit_price     numeric(18,4) not null default 0 check (unit_price >= 0),
  note           text,
  line_no        integer not null,
  constraint purchase_order_line_no_unique unique (order_id, line_no)
);

create index if not exists purchase_request_tenant_ix on purchase_request (tenant_id, branch_id, status);
create index if not exists purchase_order_tenant_ix   on purchase_order (tenant_id, branch_id, status);
create index if not exists purchase_order_supplier_ix on purchase_order (supplier_id);
create index if not exists purchase_request_line_ix   on purchase_request_line (request_id);
create index if not exists purchase_order_line_ix     on purchase_order_line (order_id);

-- ── Kiracı yalıtımı (ADR-004) ─────────────────────────────────────────────
-- `force` satırı şart: onsuz tablonun SAHİBİ politikayı atlar.
do $$
declare v_tablo text;
begin
  foreach v_tablo in array array[
    'purchase_request','purchase_request_line','purchase_order','purchase_order_line'
  ]
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
-- RLS ile GRANT İKİ AYRI KAPIDIR (0017'de bu unutuldu ve ekran
-- "permission denied" verdi). RLS "hangi satırları görür"ü, GRANT "hiç
-- dokunabilir mi"yi belirler; politika yazmak GRANT'i vermiş saymaz.
grant select, insert, update on
  purchase_request, purchase_request_line, purchase_order, purchase_order_line
  to authenticated;

-- Satır SİLME yalnızca kalemlerde var: taslak bir talepten kalem çıkarmak
-- meşru bir düzenlemedir. Talebin/siparişin KENDİSİ silinmez — iptal edilir
-- (`status = 'CANCELLED'`), yoksa "bu sipariş neden verilmedi" sorusu
-- cevapsız kalır.
grant delete on purchase_request_line, purchase_order_line to authenticated;

revoke all privileges on
  purchase_request, purchase_request_line, purchase_order, purchase_order_line
  from anon;

-- ── updated_at ────────────────────────────────────────────────────────────
-- `app.touch_updated_at()` 0017'de tanımlandı.
drop trigger if exists purchase_request_touch on purchase_request;
create trigger purchase_request_touch before update on purchase_request
  for each row execute function app.touch_updated_at();

drop trigger if exists purchase_order_touch on purchase_order;
create trigger purchase_order_touch before update on purchase_order
  for each row execute function app.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA — dördü de dolu satır döndürmeli
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Dört tabloda da RLS açık, zorlanıyor ve politikası var mı?
select
  c.relname as tablo,
  case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
  case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
  (select count(*) from pg_policies p where p.tablename = c.relname) as politika
from pg_class c
where c.relname in ('purchase_request','purchase_request_line','purchase_order','purchase_order_line')
order by c.relname;

-- 2) TABLO İZİNLERİ — boş dönerse ekran "permission denied" verir.
--    Beklenen: dört tabloda authenticated için SELECT/INSERT/UPDATE,
--    yalnızca *_line tablolarında ayrıca DELETE. `anon` hiç görünmemeli.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('purchase_request','purchase_request_line','purchase_order','purchase_order_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) Durum kısıtları yerinde mi?
select conrelid::regclass as tablo, conname as kisit
from pg_constraint
where conname like 'purchase%status%' or conname like 'purchase%_check'
order by 1, 2;

-- 4) Sipariş → tedarikçi bağı kurulu mu?
select conname, confrelid::regclass as hedef
from pg_constraint
where conrelid = 'purchase_order'::regclass and contype = 'f'
order by conname;
