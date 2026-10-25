-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0093 — ŞAHİT NUMUNE
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- Depoda `%numune%` / `%sample%` deseninde **hiç tablo yoktu.** Donmuş iki
-- ekran (Numune Takibi, Şahit Numune) yalnız uydurma veriyle vardı; yani
-- "bırakmadık, hiç başlamamıştık" (HEDEFLER 3.9).
--
-- İsmet'in cevabı (25.10.2026, Emrah üzerinden):
--   *"Gıda teknikeri ve depocu kontrolünde oluyor; üretim her ürettiği
--    parti üründen şahit numune alıyor."*
--
-- Emrah'ın anlattığı kural (20.10):
--   *"Ürün raf ömrü ne kadarsa o kadar tutuluyor, SKT sonu gelene kadar...
--    Müşteriye saklaması gereken koşullar söylenir ve satılan ürün aynı
--    şartlarda bizde de saklanır. Birebir aynısı, müşteri gibi."*
--
-- ── ÜÇ KURAL, ÜÇÜ DE VERİTABANINDA ───────────────────────────────────────
-- **1 · Numune PARTİYE bağlı, ürün adına değil.** İsmet "her ürettiği parti
--    üründen" dedi. Ürün adına bağlamak, bir tartışmada hangi partinin
--    numunesi olduğunu söyleyemezdi — numunenin bütün amacı o.
--
-- **2 · Saklama süresi SABİT DEĞİL, partiden TÜRETİLİYOR.** "72 saat" gibi
--    tek bir sayı yazılmıyor: `keep_until = stock_lot.expires_on`.
--    ⚠️ Ekranın bu alanı YAZMASINA izin verilmiyor; tetik kendisi dolduruyor.
--    Elle yazdırmak, kuralı ilk gün bozardı.
--
-- **3 · Saklama koşulu MÜŞTERİYE SÖYLENENİN AYNISI.**
--    ⚠️ BU KURAL BUGÜNE KADAR UYGULANAMIYORDU ve ölçüm bunu gösterdi:
--    saklama koşulu hiçbir yerde SAKLANMIYORDU. Etiket ekranında
--    (`Etiketler.tsx`) her baskıda ELLE yazılan serbest bir metin alanıydı
--    — yani aynı ürün iki baskıda iki farklı koşul taşıyabiliyordu.
--    Numuneyi oradan beslemek, "birebir aynısı" iddiasını ilk gün
--    yalanlardı. Bu yüzden koşul artık ÜRÜN KARTINDA duruyor
--    (`stock_item.storage_condition`) ve numune oradan kopyalanıyor.
--    Etiket ekranının da oradan okuması gerekiyor → HEDEFLER 3.9.3.
--
-- ── NE REDDEDİLİYOR ──────────────────────────────────────────────────────
-- · SKT'si olmayan partiden numune alınamaz (saklama sonu türetilemez).
-- · Saklama koşulu tanımsız üründen numune alınamaz (kural 3 çöker).
-- · Numune satırı DEĞİŞTİRİLEMEZ ve SİLİNEMEZ: durum, olay defterinden
--   türetiliyor. "Numune vardı ama artık yok" denemiyor.
-- · Aynı partinin aynı anda iki AÇIK numunesi olamaz; imhadan sonra
--   yeniden numune alınabilir.
--
-- ── KİM ──────────────────────────────────────────────────────────────────
-- Emrah'ın kararı: *"her ikisine de bağla, ortak bir iş."* Kapı
-- `quality.record.manage` **veya** `production.write`. Yani kalite
-- sorumlusu/gıda mühendisi de, üretim sorumlusu da numune alabiliyor.
-- ⚠️ Depocu "kontrolünde" — bu bir fiziksel sorumluluk, sistem izni değil.
-- İzin vermek, depocunun kendi başına numune kaydı AÇMASI demek olurdu ve
-- İsmet öyle demedi.
--
-- ⚠️ İmzayı İSTEMCİ GÖNDERMİYOR: `taken_by` tetikte `app.aktif_kullanici_id()`
-- ile yazılıyor (0081/0087 deseni). Gönderilen değer yok sayılıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · SAKLAMA KOŞULU ÜRÜN KARTINA ──────────────────────────────────────
-- ⚠️ Geriye dönük DOLDURULMUYOR. Bilinmeyen koşulu uydurmak, bu göçün
-- engellemeye çalıştığı şeyin ta kendisi olurdu.
alter table stock_item
  add column if not exists storage_condition text;

alter table stock_item drop constraint if exists stock_item_storage_condition_check;
alter table stock_item add constraint stock_item_storage_condition_check
  check (storage_condition is null or btrim(storage_condition) <> '');

comment on column stock_item.storage_condition is
  'Musteriye BILDIRILEN saklama kosulu (ornek: -18 C, 0-4 C). Sahit numune '
  'bu alandan kopyalanir (0093). Etiket de buradan okumali.';


-- ── 2 · NUMUNE DEFTERİ ────────────────────────────────────────────────────
create table if not exists witness_sample (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenant(id)     on delete restrict,
  branch_id         uuid not null references branch(id)     on delete restrict,
  stock_item_id     uuid not null references stock_item(id) on delete restrict,
  -- ⚠️ Partiye bağlı, ürüne değil. Numunenin amacı bir tartışmayı çözmek.
  lot_id            uuid not null references stock_lot(id)  on delete restrict,
  -- Hangi iş emrinden çıktı. Boş kalabilir: açılış bakiyesi gibi lotlar var.
  work_order_id     uuid references work_order(id)          on delete restrict,

  sample_code       text not null,
  sample_code_key   text not null,

  taken_at          timestamptz not null default now(),
  -- ⚠️ Sunucu yazar. İstemciden gelen değer yok sayılır.
  taken_by          uuid references app_user(id) on delete set null,

  -- ⚠️ ÜRÜN KARTINDAN KOPYALANIR ve DONAR. Kart sonradan değişse bile bu
  -- numune, alındığı gün müşteriye söylenen koşulu taşımalı.
  storage_condition text not null,
  -- ⚠️ PARTİDEN TÜRETİLİR (`stock_lot.expires_on`).
  keep_until        date not null,

  -- Açılmış ürün: açıldıktan sonra uygun olduğu gün sayısı.
  opened_shelf_life_days integer
    check (opened_shelf_life_days is null or opened_shelf_life_days > 0),

  status            text not null default 'SAKLANIYOR'
                      check (status in ('SAKLANIYOR','ACILDI','IMHA')),
  note              text,
  created_at        timestamptz not null default now(),

  constraint witness_sample_code_unique unique (tenant_id, sample_code_key),
  constraint witness_sample_code_not_blank check (btrim(sample_code) <> '')
);

create index if not exists witness_sample_tenant_ix on witness_sample (tenant_id);
create index if not exists witness_sample_lot_ix    on witness_sample (lot_id);
create index if not exists witness_sample_sure_ix   on witness_sample (tenant_id, keep_until);

-- ⚠️ Aynı partinin aynı anda İKİ AÇIK numunesi olamaz; imha edilmiş numune
-- bu kısıtın dışında, çünkü imhadan sonra yeniden numune alınabilir.
create unique index if not exists witness_sample_acik_lot_unique
  on witness_sample (tenant_id, lot_id) where status <> 'IMHA';

alter table witness_sample enable row level security;
alter table witness_sample force  row level security;
drop policy if exists witness_sample_tenant_isolation on witness_sample;
create policy witness_sample_tenant_isolation on witness_sample
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());


-- ── 3 · OLAY DEFTERİ · append-only ───────────────────────────────────────
-- ⚠️ Durum bu defterden TÜRETİLİYOR. "Numune vardı ama artık yok" diyebilmek
-- için numune satırını silmek ya da durumu elle yazmak gerekirdi; ikisi de
-- kapalı.
create table if not exists witness_sample_event (
  id             bigserial primary key,
  tenant_id      uuid not null references tenant(id) on delete restrict,
  sample_id      uuid not null references witness_sample(id) on delete restrict,
  event_type     text not null check (event_type in ('ALINDI','ACILDI','IMHA')),
  occurred_at    timestamptz not null default now(),
  actor_user_id  uuid references app_user(id) on delete set null,
  -- ⚠️ AÇILIŞ ve İMHA gerekçe İSTER. Gerekçesiz açılan numune, açılmamış
  -- numuneden farksızdır: kimse neden açıldığını bilemez.
  reason         text,
  -- Açılışın sonucu: "ürün uygun", "koku var" vb. Müşteri önünde açılıyor.
  result         text,
  constraint witness_sample_event_reason_required check (
    event_type = 'ALINDI' or (reason is not null and btrim(reason) <> '')
  )
);

create index if not exists witness_sample_event_sample_ix
  on witness_sample_event (sample_id, occurred_at);

alter table witness_sample_event enable row level security;
alter table witness_sample_event force  row level security;
drop policy if exists witness_sample_event_tenant_isolation on witness_sample_event;
create policy witness_sample_event_tenant_isolation on witness_sample_event
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());


-- ── 4 · TÜRETME VE İMZA ──────────────────────────────────────────────────
create or replace function app.numune_turet()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare
  v_skt   date;
  v_kosul text;
  v_kalem uuid;
begin
  select l.expires_on, l.stock_item_id into v_skt, v_kalem
    from public.stock_lot l where l.id = new.lot_id;

  if v_kalem is null then
    raise exception 'MİYOP: numunenin partisi bulunamadı.' using errcode = 'MI404';
  end if;

  -- Kalem partiden gelir: istemcinin gönderdiği kalem yanlışsa düzeltilir.
  new.stock_item_id := v_kalem;

  if v_skt is null then
    raise exception
      'MİYOP: bu partinin son kullanma tarihi yok; şahit numunenin saklama '
      'sonu hesaplanamaz. Önce partiye SKT yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ TÜRETİLİYOR. İstemci ne gönderirse göndersin, saklama sonu partinin
  -- SKT'sidir (kural 1).
  new.keep_until := v_skt;

  select nullif(btrim(i.storage_condition), '') into v_kosul
    from public.stock_item i where i.id = v_kalem;

  if v_kosul is null then
    raise exception
      'MİYOP: bu ürünün saklama koşulu tanımlı değil. Şahit numune, '
      'müşteriye bildirilen koşulun AYNISINDA saklanmak zorunda; önce ürün '
      'kartına saklama koşulunu yazın.'
      using errcode = 'MI422';
  end if;
  -- ⚠️ KOPYALANIYOR (kural 3). Ekranın yazdığı değer yok sayılıyor.
  new.storage_condition := v_kosul;

  -- ⚠️ İmza sunucuda (0081/0087 deseni).
  new.taken_by := app.aktif_kullanici_id();
  new.status   := 'SAKLANIYOR';

  return new;
end $$;

revoke all on function app.numune_turet() from public;
revoke all on function app.numune_turet() from anon;
revoke all on function app.numune_turet() from authenticated;

drop trigger if exists numune_turet on public.witness_sample;
create trigger numune_turet
  before insert on public.witness_sample
  for each row execute function app.numune_turet();


-- ── 5 · OLAY DURUMU YÜRÜTÜR ──────────────────────────────────────────────
create or replace function app.numune_olayi()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare v_durum text;
begin
  new.actor_user_id := app.aktif_kullanici_id();

  select s.status into v_durum from public.witness_sample s where s.id = new.sample_id;
  if v_durum is null then
    raise exception 'MİYOP: numune bulunamadı.' using errcode = 'MI404';
  end if;

  -- ⚠️ İmha edilmiş numuneye yeni olay yazılamaz: defter kapanmıştır.
  if v_durum = 'IMHA' then
    raise exception 'MİYOP: imha edilmiş numuneye yeni kayıt eklenemez.'
      using errcode = 'MI409';
  end if;

  if new.event_type = 'ACILDI' then
    update public.witness_sample set status = 'ACILDI' where id = new.sample_id;
  elsif new.event_type = 'IMHA' then
    update public.witness_sample set status = 'IMHA' where id = new.sample_id;
  end if;

  return new;
end $$;

revoke all on function app.numune_olayi() from public;
revoke all on function app.numune_olayi() from anon;
revoke all on function app.numune_olayi() from authenticated;

drop trigger if exists numune_olayi on public.witness_sample_event;
create trigger numune_olayi
  before insert on public.witness_sample_event
  for each row execute function app.numune_olayi();

-- ⚠️ Olay defteri DEĞİŞMEZ. Yazılan kayıt düzeltilmez, silinmez.
create or replace function app.numune_olayi_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Numune olay kaydı değiştirilemez ve silinemez.'
    using errcode = 'MI403';
end $$;

drop trigger if exists numune_olayi_degismez on public.witness_sample_event;
create trigger numune_olayi_degismez
  before update or delete on public.witness_sample_event
  for each row execute function app.numune_olayi_degismez();


-- ── 6 · YETKİ KAPISI ─────────────────────────────────────────────────────
-- Emrah: *"her ikisine de bağla, ortak bir iş olabileceğini de belirt."*
drop trigger if exists izin_witness_sample on public.witness_sample;
create trigger izin_witness_sample
  before insert or update on public.witness_sample
  for each row execute function
    app.izin_gerek_coklu('quality.record.manage', 'production.write');

drop trigger if exists izin_witness_sample_event on public.witness_sample_event;
create trigger izin_witness_sample_event
  before insert on public.witness_sample_event
  for each row execute function
    app.izin_gerek_coklu('quality.record.manage', 'production.write');


-- ── 7 · DENETİM ──────────────────────────────────────────────────────────
drop trigger if exists denetim_witness_sample on public.witness_sample;
create trigger denetim_witness_sample
  after insert or update or delete on public.witness_sample
  for each row execute function app.denetim_yaz();

drop trigger if exists denetim_witness_sample_event on public.witness_sample_event;
create trigger denetim_witness_sample_event
  after insert on public.witness_sample_event
  for each row execute function app.denetim_yaz();


-- ── 8 · YETKİLER ─────────────────────────────────────────────────────────
-- ⚠️ DELETE HİÇBİRİNDE YOK. Numune "kayboldu" diyemesin.
-- ⚠️ `witness_sample` için UPDATE de YOK: durum olaydan türetiliyor,
-- tetik `security definer` olarak yazıyor. Ekranın durumu elle yazması
-- kuralı delerdi.
grant select, insert on witness_sample       to authenticated;
grant select, insert on witness_sample_event to authenticated;
grant usage on sequence witness_sample_event_id_seq to authenticated;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  select string_agg(t, ', ') into v_eksik
    from unnest(array['witness_sample','witness_sample_event']) t
   where not exists (
     select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t);
  if v_eksik is not null then
    raise exception '0093: şu tablolar oluşmadı: %', v_eksik;
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_name = 'stock_item' and column_name = 'storage_condition') then
    raise exception '0093: stock_item.storage_condition oluşmadı.';
  end if;

  -- ⚠️ Her iki tablo da DENETLENİYOR mu? (0091'in kuralı yeni tablolara da
  -- uygulanmalı; yoksa denetimsiz yüzey sessizce büyür.)
  select string_agg(t, ', ') into v_eksik
    from unnest(array['witness_sample','witness_sample_event']) t
   where not exists (
     select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
      where c.relname = t and g.tgname = 'denetim_' || t and not g.tgisinternal);
  if v_eksik is not null then
    raise exception '0093: şu tablolarda denetim tetiği yok: %', v_eksik;
  end if;

  -- ⚠️ DELETE yetkisi VERİLMEMİŞ olmalı.
  if has_table_privilege('authenticated', 'public.witness_sample', 'delete')
     or has_table_privilege('authenticated', 'public.witness_sample_event', 'delete') then
    raise exception '0093: numune tablolarında DELETE yetkisi var.';
  end if;
  if has_table_privilege('authenticated', 'public.witness_sample', 'update') then
    raise exception '0093: witness_sample UPDATE yetkisi var; durum olaydan türetilmeli.';
  end if;

  raise notice '0093: Şahit numune defteri kuruldu (parti bazlı, append-only).';
end $$;
