-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0025 — Fiziksel sayım belgesi, sayım kilidi, zayi sebep kodu
--
-- Yol haritası maddeleri:
--   "Fiziksel sayım → fark hareketi"  → Üstüne yazma yok, fark ayrı kayıt
--   "Sayım kilidi"                    → Sayım sırasında ilgili kalemlere hareket
--                                       girilemiyor
--   "Fire, zayi, SKT geçmiş lot imhası" → Üçü de AYRI sebep koduyla deftere düşüyor
--
-- ── BUGÜN NE VAR, NE EKSİK ───────────────────────────────────────────────
-- `DepoServisi.sayim()` tek bir kalemi sayıp FARKI deftere yazıyor ve bu doğru
-- çalışıyor. Eksik olan iki şey:
--
--   1. BELGE. Bir fabrika 400 kalemi tek tek yan panelden saymaz; sayım bir
--      oturumdur. Kim başlattı, ne zaman, hangi kalemler, kim saydı, ne zaman
--      uygulandı — hepsi tek belgede durmalı. Denetimde istenen budur.
--
--   2. KİLİT. Sayım sürerken o kalemlere hareket girilirse sayım anlamsızdır:
--      "40 kg saydım" ile "deftere göre 45 kg" arasındaki fark, gerçek fark mı
--      yoksa sayarken çıkan mal mı belli olmaz.
--
-- ── KİLİT NEDEN VERİTABANINDA ────────────────────────────────────────────
-- Uygulama katmanında "sayım açıkken düğmeyi kapat" yapmak KİLİT DEĞİLDİR:
-- başka bir ekran, bir toplu iş ya da yarın yazılacak bir servis o düğmeyi
-- hiç görmez. Kilit, hareketin yazıldığı yerde durmalı — append-only
-- zorlamasıyla aynı gerekçe (ADR-001).
--
-- ── DONDURULMUŞ BEKLENEN MİKTAR ──────────────────────────────────────────
-- Satırda `expected_qty` var: sayım açıldığı anda defterin ne dediği.
-- Uygulama anında yeniden hesaplamıyoruz, çünkü KİLİT sayesinde ikisi zaten
-- aynı olmak zorunda. Farklıysa bir yerde kilit delinmiş demektir ve bunu
-- görmek isteriz — bu yüzden saklıyoruz.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Zayi sebep kodu ───────────────────────────────────────────────────
-- "Fire, zayi, SKT imhası" üç AYRI şeydir ve tek koda sıkıştırılamaz:
--   WASTE            fire   — bozuldu, döküldü, işlenirken kayboldu
--   LOSS             zayi   — kırıldı, çalındı, sayımda bulunamadı
--   EXPIRY_WRITE_OFF imha   — son kullanma tarihi geçti
-- Aynı koda yazsaydık "fire oranımız yükseldi mi" sorusu cevaplanamazdı.
alter table stock_movement drop constraint if exists stock_movement_reason_check;
alter table stock_movement add constraint stock_movement_reason_check
  check (reason in (
    'PURCHASE_RECEIPT','PURCHASE_RETURN',
    'PRODUCTION_CONSUME','PRODUCTION_OUTPUT','PRODUCTION_WASTE',
    'SHIPMENT_OUT','SHIPMENT_RETURN',
    'COUNT_SURPLUS','COUNT_SHORTAGE',
    'EXPIRY_WRITE_OFF','WASTE','LOSS',
    'TRANSFER_IN','TRANSFER_OUT',
    'OPENING_BALANCE','REVERSAL'));

-- ── 2 · Sayım belgesi ─────────────────────────────────────────────────────
create table if not exists stock_count (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete restrict,
  branch_id   uuid not null references branch(id) on delete restrict,
  count_no    text not null,

  -- DRAFT     — kalemler seçiliyor, kilit YOK
  -- OPEN      — sayım sürüyor, KİLİT AKTİF, sayılan miktarlar giriliyor
  -- APPLIED   — farklar deftere yazıldı, kilit kalktı
  -- CANCELLED — vazgeçildi, deftere hiçbir şey yazılmadı
  status      text not null default 'DRAFT'
                check (status in ('DRAFT','OPEN','APPLIED','CANCELLED')),

  note        text,
  opened_at   timestamptz,
  applied_at  timestamptz,
  opened_by   uuid references app_user(id) on delete set null,
  applied_by  uuid references app_user(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint stock_count_no_unique unique (tenant_id, count_no),
  -- Uygulanmış bir sayım ne zaman ve kim tarafından uygulandığını SÖYLEMEK
  -- zorunda. Boş bırakılırsa denetimde "bu farkı kim yazdı" cevapsız kalır.
  constraint stock_count_uygulama check (
    status <> 'APPLIED' or (applied_at is not null))
);

create index if not exists stock_count_acik_ix
  on stock_count (tenant_id, branch_id, status);

-- ── 3 · Sayım satırı ──────────────────────────────────────────────────────
create table if not exists stock_count_line (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,
  count_id      uuid not null references stock_count(id) on delete cascade,
  line_no       integer not null,
  stock_item_id uuid not null references stock_item(id) on delete restrict,
  -- Lot takipli kalemde her parti AYRI sayılır: "toplam 40 kg" yetmez,
  -- hangi partiden kaç kaldığı bilinmezse FEFO çalışamaz.
  lot_id        uuid references stock_lot(id) on delete restrict,

  -- Sayım AÇILDIĞI andaki defter bakiyesi (temel birimde). Dondurulmuştur.
  expected_qty  numeric(18,6) not null,
  -- Fiziksel sayım sonucu. Sayılana kadar BOŞ — 0 ile "sayılmadı" aynı şey değil.
  counted_qty   numeric(18,6),
  uom           text not null,

  -- Uygulandığında yazılan fark hareketi. Fark sıfırsa boş kalır.
  movement_id   uuid references stock_movement(id) on delete restrict,
  note          text,
  counted_at    timestamptz,
  counted_by    uuid references app_user(id) on delete set null,

  constraint stock_count_line_no_unique unique (count_id, line_no),
  constraint stock_count_line_sayilan check (counted_qty is null or counted_qty >= 0)
);

-- Aynı kalem/parti bir sayımda iki kez olamaz. `lot_id` boş olabildiği için
-- ifade tabanlı tekil indeks kullanılıyor.
create unique index if not exists stock_count_line_kalem_unique
  on stock_count_line (
    count_id, stock_item_id,
    coalesce(lot_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists stock_count_line_kalem_ix
  on stock_count_line (stock_item_id);

-- ── 4 · SAYIM KİLİDİ ──────────────────────────────────────────────────────
-- Bir kalem AÇIK bir sayımda geçiyorsa o kaleme hareket yazılamaz.
-- Tek istisna: sayımın KENDİ fark hareketleri (source_id = o sayımın kimliği).
create or replace function app.stock_count_lock()
returns trigger
language plpgsql
as $$
declare
  engelleyen text;
begin
  select c.count_no into engelleyen
  from stock_count c
  join stock_count_line l on l.count_id = c.id
  where c.status = 'OPEN'
    and c.tenant_id = new.tenant_id
    and c.branch_id = new.branch_id
    and l.stock_item_id = new.stock_item_id
    and not (new.source_type = 'count' and new.source_id = c.id)
  limit 1;

  if engelleyen is not null then
    raise exception
      'Bu kalem % sayımında ve sayım açık. Sayım bitmeden hareket yazılamaz.',
      engelleyen
      using hint = 'Sayımı uygulayın ya da iptal edin, sonra tekrar deneyin.';
  end if;

  return new;
end $$;

drop trigger if exists stock_movement_count_lock on stock_movement;
create trigger stock_movement_count_lock
  before insert on stock_movement
  for each row execute function app.stock_count_lock();

drop trigger if exists stock_count_touch on stock_count;
create trigger stock_count_touch before update on stock_count
  for each row execute function app.touch_updated_at();

-- ── 5 · RLS ───────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['stock_count','stock_count_line'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists %I on %I', t || '_tenant_isolation', t);
    execute format(
      'create policy %I on %I using (tenant_id = app.current_tenant_id()) '
      'with check (tenant_id = app.current_tenant_id())',
      t || '_tenant_isolation', t);
  end loop;
end $$;

-- ── 6 · İzinler ───────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR.
grant select, insert, update on stock_count      to authenticated;
grant select, insert, update, delete on stock_count_line to authenticated;
-- Sayım belgesi SİLİNMEZ, iptal edilir: sayıldı ve vazgeçildi bilgisi de bilgidir.
revoke all privileges on stock_count, stock_count_line from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) RLS açık, zorlanıyor, politikası var mı?
select c.relname as tablo,
       case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
       case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
       (select count(*) from pg_policies p where p.tablename = c.relname) as politika
from pg_class c
where c.relname in ('stock_count','stock_count_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('stock_count','stock_count_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) Zayi kodu eklendi mi? 'LOSS' görünmeli.
select unnest(string_to_array(
         regexp_replace(pg_get_constraintdef(oid), '.*ARRAY\[|\]\)\)|''', '', 'g'),
         ', ')) as sebep_kodu
from pg_constraint
where conname = 'stock_movement_reason_check';

-- 4) Kilit tetikleyicisi kurulu mu? 1 satır dönmeli.
select tgname as tetikleyici, tgenabled as durum
from pg_trigger
where tgname = 'stock_movement_count_lock';
