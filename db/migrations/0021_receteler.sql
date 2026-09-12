-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 3 / Üretim ve izlenebilirlik
-- 0021 — Reçeteler
--
-- Yol haritası maddesi: "Reçete yönetimi gerçek veriye bağlı"
--                       Bitti sayılır ki: "Reçete kalemleri stok kartlarına bağlı"
--
-- ── REÇETE BİR TARİF DEĞİL, BİR BAĞ ──────────────────────────────────────
-- Kritik olan kelime kriterde: "stok kartlarına BAĞLI". Reçete satırı serbest
-- metin olsaydı ("2 kg un") sistem hiçbir soruyu cevaplayamazdı: hangi un,
-- depoda var mı, kaç lira, hangi lot. `stock_item_id` ile bağlanınca reçete
-- bir tarif olmaktan çıkıp hesaplanabilir bir şeye dönüşüyor:
--
--   • 500 porsiyon için hangi malzemeden ne kadar lazım?
--   • Bu miktar depoda VAR MI?  (bakiye defterden gelir)
--   • Bu üretim kaç liraya mal olur? (maliyet defterden gelir)
--
-- ── VERİM ORANI NEDEN İKİ YERDE ──────────────────────────────────────────
-- İki ayrı kayıp vardır ve karıştırılmamaları gerekir:
--
--   SATIR FİRESİ (`waste_pct`) — o malzemeye özgü. Soğanın kabuğu atılır:
--     10 kg soğan alırsınız, 8 kg soğan kullanırsınız. Malzemeden malzemeye
--     değişir; patatesinki başka, unun ki yoktur.
--
--   VERİM (`yield_pct`)        — üretimin tamamına ait. 100 kg girdi koyarsınız,
--     tencerede buharlaşır, kazanın dibinde kalır, 92 kg mamul çıkar.
--     Malzemeye değil, PROSESE aittir.
--
-- Tek alanda toplasaydık, "soğan bu ay çok kabuklu geldi" ile "kazan değişti,
-- verim düştü" aynı rakama karışırdı ve ikisi de görünmez olurdu.
--
-- ── NEDEN ŞUBE YOK ───────────────────────────────────────────────────────
-- Reçete firmanın malıdır, şubenin değil: aynı mercimek çorbası her şubede
-- aynı tarifle yapılır. Bu yüzden `supplier` gibi KİRACI kapsamlı.
-- Üretim iş emri ise şubelidir — o hangi mutfakta piştiğini bilir (0022).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists recipe (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id) on delete restrict,
  code              text not null,
  code_key          text not null,          -- normalleştirilmiş; tekillik bunun üzerinden
  name              text not null,

  -- Ne üretiliyor. Mamul de bir stok kartıdır — ayrı bir "ürün" tablosu YOK.
  -- Sebebi: mamul üretildiği anda stoktur, sevk edilir, sayılır, SKT'si olur.
  -- Ayrı tabloda tutsaydık defter iki ayrı dünyaya bölünürdü.
  output_item_id    uuid not null references stock_item(id) on delete restrict,

  -- Reçete bu miktar için yazılır: "100 porsiyon için…". Ölçeklemeyi iş emri
  -- yapar. Tek porsiyona indirgemek, küsuratlı satırlar üretip okunmaz hâle
  -- getirirdi (0,0075 kg tuz).
  output_qty        numeric(18,6) not null check (output_qty > 0),
  output_uom        text not null references uom(code),

  -- Prosesin verimi, yüzde. 100 = kayıpsız. 92 = girdinin %8'i buharlaşıyor.
  yield_pct         numeric(6,3) not null default 100
                      check (yield_pct > 0 and yield_pct <= 100),

  -- DRAFT   : yazılıyor, iş emrinde kullanılamaz
  -- ACTIVE  : yürürlükte
  -- ARCHIVED: kullanımdan kalktı ama geçmiş iş emirleri ona bakıyor — SİLİNMEZ
  status            text not null default 'DRAFT'
                      check (status in ('DRAFT','ACTIVE','ARCHIVED')),

  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint recipe_code_unique unique (tenant_id, code_key)
);

create index if not exists recipe_tenant_ix on recipe (tenant_id, status);
create index if not exists recipe_output_ix on recipe (output_item_id);

create table if not exists recipe_line (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete restrict,
  recipe_id      uuid not null references recipe(id) on delete cascade,
  line_no        integer not null,

  -- ⚠️ KRİTERİN KENDİSİ. Serbest metin DEĞİL, stok kartına bağ.
  stock_item_id  uuid not null references stock_item(id) on delete restrict,

  qty            numeric(18,6) not null check (qty > 0),
  uom            text not null references uom(code),

  -- O malzemeye özgü fire payı: kabuk, sap, kemik. Verimden ayrıdır.
  waste_pct      numeric(6,3) not null default 0
                   check (waste_pct >= 0 and waste_pct < 100),

  note           text,
  constraint recipe_line_no_unique unique (recipe_id, line_no),
  -- Aynı malzeme aynı reçetede iki kez yazılamaz: "2 kg un" ve "3 kg un"
  -- satırları, birini güncelleyip diğerini unutmanın en kısa yoludur.
  constraint recipe_line_item_unique unique (recipe_id, stock_item_id)
);

create index if not exists recipe_line_recipe_ix on recipe_line (recipe_id);
create index if not exists recipe_line_item_ix   on recipe_line (stock_item_id);

-- ── Bir mamul kendi reçetesinin malzemesi olamaz ──────────────────────────
-- Doğrudan döngü (A → A) burada engelleniyor. Dolaylı döngü (A → B → A) için
-- veritabanı kısıtı yazmak, her satır eklemede özyinelemeli sorgu demek
-- olurdu; onu servis katmanı kontrol ediyor (recipe.service.ts).
create or replace function app.recipe_line_no_self_reference()
returns trigger language plpgsql as $$
declare
  cikti uuid;
begin
  select output_item_id into cikti from recipe where id = new.recipe_id;
  if cikti = new.stock_item_id then
    raise exception 'Bir mamul kendi reçetesinin malzemesi olamaz.';
  end if;
  return new;
end $$;

drop trigger if exists recipe_line_self_ref on recipe_line;
create trigger recipe_line_self_ref before insert or update on recipe_line
  for each row execute function app.recipe_line_no_self_reference();

-- ── RLS ───────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['recipe','recipe_line'] loop
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
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR. Politika yazmak tabloya erişim vermez;
-- bu unutulunca ekran "permission denied for table recipe" der. 0017'de bir
-- kez yaşandı, tekrarlanmasın.
grant select, insert, update on recipe      to authenticated;
grant select, insert, update, delete on recipe_line to authenticated;
-- Reçete SİLİNMEZ, arşivlenir: geçmiş iş emirleri ona bakıyor.
-- Reçete SATIRI silinebilir — reçeteyi düzenlerken satır çıkarmak meşrudur
-- ve iş emri satırları zaten kendi kopyasını taşıyor (0022).
revoke all privileges on recipe, recipe_line from anon;

drop trigger if exists recipe_touch on recipe;
create trigger recipe_touch before update on recipe
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
where c.relname in ('recipe','recipe_line')
order by c.relname;

-- 2) İzinler — boş dönerse ekran "permission denied" verir.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as izinler
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('recipe','recipe_line')
  and grantee in ('authenticated','anon')
group by table_name, grantee
order by table_name, grantee;

-- 3) KRİTER: reçete satırı stok kartına BAĞLI mı?
--    `recipe_line_stock_item_id_fkey → stock_item` satırı görünmeli.
select conname, confrelid::regclass as hedef
from pg_constraint
where conrelid = 'recipe_line'::regclass and contype = 'f'
order by conname;
