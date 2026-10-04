-- ═══════════════════════════════════════════════════════════════════════════
-- 0064 · ARAÇ VE ŞOFÖR KARTLARI · SEVKİYATA BAĞLANMASI
-- ---------------------------------------------------------------------------
-- Yol haritası (A4B), üç madde birden:
--   "Araç ve şoför kartları"      → plaka, şoför, kapasite ve soğutma kayıtlı
--   "Sevkiyata sefer bağlanıyor"  → hangi mal, hangi plakayla, kimin götürdüğü
--   "İrsaliyede araç ve şoför görünüyor"
--
-- Word'ün bu aşama için yazdığı gerekçe: *"CCP-8 (sevk aracı en çok 4 °C)
-- sistemde hazır duruyor ama ölçümü hangi araçta yapıldığı yazılmıyor."*
--
-- ── CCP-8 İÇİN YENİ KOLON AÇILMADI ────────────────────────────────────────
-- Yükleme sıcaklığı `shipment` tablosuna bir sütun olarak EKLENMEDİ.
-- `haccp_measurement` zaten `source_type='shipment'` kabul ediyor (0024).
-- Ölçüm oraya yazılır; araç bilgisi sevkiyattan okunur. Böylece:
--   · ölçüm HACCP defterindedir, yasal kayıt olarak orada durur,
--   · PASS/FAIL ve limit anlık fotoğrafı 0024'ün kurallarıyla donar,
--   · FAIL bir ölçüm düzeltici faaliyet açar — sevkiyata kolon koysaydık
--     bunların HİÇBİRİ çalışmazdı, elimizde yalnız bir sayı olurdu.
--
-- ── ARAÇ VE ŞOFÖR AYRI TABLOLAR ───────────────────────────────────────────
-- Tek tabloda birleştirmek ("araç + sabit şoförü") gerçeğe uymuyor: aynı araç
-- farklı günlerde farklı şoförle çıkar, aynı şoför farklı araca biner. Bağ
-- SEVKİYATTA kuruluyor — o günkü gerçeği belge taşıyor.
--
-- ⚠️ ŞOFÖR, `app_user` DEĞİLDİR. Şoför çoğu zaman sisteme girmez; taşeron
-- olabilir. Kullanıcı tablosuna bağlasaydık her şoför için giriş hesabı açmak
-- gerekirdi. İleride şoför MİYOP kullanırsa `app_user_id` eklenir.
--
-- ⚠️ SİLİNMİYOR, PASİFE ALINIYOR. Silmek, o araçla kesilmiş irsaliyelerin
-- geçmişini kopuk bırakırdı (0047'deki aynı karar).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ARAÇ ──────────────────────────────────────────────────────────────
create table if not exists vehicle (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete restrict,

  -- Plaka BELGEDE görünen kimliktir. Arama ve tekillik için boşluksuz,
  -- büyük harfli bir anahtar ayrıca tutuluyor (0047'deki `code_key` deseni):
  -- "34 ABC 123" ile "34ABC123" aynı araçtır.
  plate         text not null,
  plate_key     text not null,
  name          text,

  -- Taşıma kapasitesi. Boş = bilinmiyor; SIFIR YAZMIYORUZ, sıfır "hiç mal
  -- taşımaz" demektir ve bu bir karardır.
  capacity_kg   numeric(12,3) check (capacity_kg is null or capacity_kg > 0),

  -- ⚠️ SOĞUTMA BİLGİSİ CCP-8'İN ÖN KOŞULU. Soğutmasız bir araca donuk ya da
  -- soğuk ürün yüklenmesi, ölçüm yapılmadan bile bilinebilen bir hatadır.
  is_refrigerated boolean not null default false,
  -- Soğutmalıysa aracın tutabildiği aralık. Ölçümün kendisi DEĞİL, aracın
  -- yeteneği: "bu araç -18 °C'ye iner mi".
  min_temp_c    numeric(5,2),
  max_temp_c    numeric(5,2),
  constraint vehicle_sogutma_araligi check (
    not is_refrigerated
    or min_temp_c is null or max_temp_c is null
    or min_temp_c <= max_temp_c
  ),
  -- Soğutmasız araca sıcaklık aralığı yazılamaz: yazılırsa ekran onu bir
  -- yetenek sanır ve soğuk zincir ürününü oraya yükletir.
  constraint vehicle_sogutmasiz_aralik_yok check (
    is_refrigerated or (min_temp_c is null and max_temp_c is null)
  ),

  note          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint vehicle_plate_unique    unique (tenant_id, plate_key),
  constraint vehicle_plate_not_blank check (btrim(plate) <> '')
);

create index if not exists vehicle_tenant_ix on vehicle (tenant_id, is_active);

alter table vehicle enable row level security;
-- ⚠️ `force` satırı şart: onsuz tablonun SAHİBİ politikayı atlar ve iki
-- kiracı birbirinin araç listesini görebilir (0017'nin dersi).
alter table vehicle force  row level security;
drop policy if exists vehicle_tenant_isolation on vehicle;
create policy vehicle_tenant_isolation on vehicle
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists vehicle_touch on vehicle;
create trigger vehicle_touch before update on vehicle
  for each row execute function app.touch_updated_at();

-- ── 2 · ŞOFÖR ─────────────────────────────────────────────────────────────
create table if not exists driver (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete restrict,

  full_name   text not null,
  phone       text,
  -- Ehliyet sınıfı ve geçerlilik: denetimde sorulur, hatırlatma için.
  licence_class text,
  licence_valid_until date,

  note        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint driver_name_not_blank check (btrim(full_name) <> '')
);

create index if not exists driver_tenant_ix on driver (tenant_id, is_active);

alter table driver enable row level security;
alter table driver force  row level security;
drop policy if exists driver_tenant_isolation on driver;
create policy driver_tenant_isolation on driver
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

drop trigger if exists driver_touch on driver;
create trigger driver_touch before update on driver
  for each row execute function app.touch_updated_at();

-- ── 3 · SEVKİYATA BAĞ ─────────────────────────────────────────────────────
-- ⚠️ İKİSİ DE İSTEĞE BAĞLI. Zorunlu yapsaydık, araç kartı henüz girilmemiş
-- bir işletmede hiç sevkiyat açılamazdı — ve kendi aracı olmayan, kargoyla
-- gönderen işletme sisteme hiç giremezdi.
alter table shipment add column if not exists vehicle_id uuid
  references vehicle(id) on delete restrict;
alter table shipment add column if not exists driver_id  uuid
  references driver(id)  on delete restrict;

create index if not exists shipment_vehicle_ix on shipment (tenant_id, vehicle_id);
create index if not exists shipment_driver_ix  on shipment (tenant_id, driver_id);

-- ⚠️ ARAÇ VE ŞOFÖR BİZİM Mİ? Yabancı anahtar "böyle bir araç var mı" der,
-- "BİZİM aracımız mı" demez. Bu sınıf bu projede altıncı kez karşımıza
-- çıkıyor (MI424). RLS de yetmez: tetik, satırın İÇERİĞİNİ denetler.
create or replace function app.sevkiyat_araci_tutarli()
returns trigger
language plpgsql
as $$
begin
  if new.vehicle_id is not null
     and not exists (select 1 from public.vehicle v
                      where v.id = new.vehicle_id and v.tenant_id = new.tenant_id)
  then
    raise exception 'Seçilen araç bu işletmeye ait değil.' using errcode = 'MI424';
  end if;

  if new.driver_id is not null
     and not exists (select 1 from public.driver d
                      where d.id = new.driver_id and d.tenant_id = new.tenant_id)
  then
    raise exception 'Seçilen şoför bu işletmeye ait değil.' using errcode = 'MI424';
  end if;

  return new;
end;
$$;

comment on function app.sevkiyat_araci_tutarli() is
  'Sevkiyata bağlanan araç ve şoför, sevkiyatın kiracısına ait olmalı. '
  'Yabancı anahtar varlığı doğrular, aidiyeti DOĞRULAMAZ (MI424).';

drop trigger if exists shipment_arac_tutarli on shipment;
create trigger shipment_arac_tutarli
  before insert or update of vehicle_id, driver_id on shipment
  for each row execute function app.sevkiyat_araci_tutarli();

-- ── 4 · SEVK EDİLMİŞ BELGENİN ARACI DEĞİŞMEZ ──────────────────────────────
-- ⚠️ Müşterinin elindeki kâğıtta yazan plaka ile defterdeki plaka ayrışamaz.
-- Sevk edildikten sonra araç/şoför değiştirmek, kesilmiş bir belgeyi
-- sonradan düzeltmektir — bu defterin tamamına aykırı (ADR-001).
create or replace function app.sevk_sonrasi_arac_degismez()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'SHIPPED'
     and (new.vehicle_id is distinct from old.vehicle_id
          or new.driver_id is distinct from old.driver_id)
  then
    raise exception 'Sevk edilmiş irsaliyenin aracı ya da şoförü '
      'değiştirilemez. Müşterinin elindeki kâğıtta yazan plaka budur. '
      'Yanlışsa sevkiyatı iptal edip yenisini kesin.'
      using errcode = 'MI434';
  end if;
  return new;
end;
$$;

drop trigger if exists shipment_sevk_sonrasi_arac on shipment;
create trigger shipment_sevk_sonrasi_arac
  before update on shipment
  for each row execute function app.sevk_sonrasi_arac_degismez();

-- ── 5 · DENETİM ───────────────────────────────────────────────────────────
-- Araç ve şoför kartı denetlenir: "bu sevkiyatı hangi plaka taşıdı" sorusu
-- kartın sonradan değiştirilmesiyle bulanıklaşabilir.
do $$
declare
  t text;
  izlenecek text[] := array['vehicle', 'driver'];
begin
  foreach t in array izlenecek loop
    if to_regclass('public.' || t) is null then
      raise notice 'Denetim atlandı, tablo yok: %', t;
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', 'denetim_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.denetim_yaz()',
      'denetim_' || t, t
    );
  end loop;
end $$;

-- ── 6 · ERİŞİM ────────────────────────────────────────────────────────────
-- ⚠️ RLS VE GRANT AYRI KAPILARDIR (0006).
-- Silme YOK: kart pasife alınır, silinmez.
grant select, insert, update on vehicle to authenticated;
grant select, insert, update on driver  to authenticated;
revoke delete on vehicle from authenticated;
revoke delete on driver  from authenticated;

-- ── 7 · YAZMA KİLİDİ ──────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  perform app.lisans_kilidini_tak();
  select string_agg(t, ', ') into v_eksik
    from unnest(array['vehicle','driver']) t
   where not exists (
     select 1 from pg_trigger
      where tgname = 'lisans_kilidi_' || t
        and tgrelid = ('public.' || t)::regclass);
  if v_eksik is not null then
    raise notice '0064: yazma kilidi takılmamış tablo(lar): %', v_eksik;
  end if;
end $$;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
do $$
declare v_eksik text;
begin
  -- RLS iki kapıdan da geçti mi?
  select string_agg(t, ', ') into v_eksik
    from unnest(array['vehicle','driver']) t
   where not exists (
     select 1 from pg_class c
      where c.oid = ('public.' || t)::regclass
        and c.relrowsecurity and c.relforcerowsecurity);
  if v_eksik is not null then
    raise exception '0064: RLS eksik (enable + force): %', v_eksik;
  end if;

  if not exists (select 1 from information_schema.columns
                  where table_name = 'shipment' and column_name = 'vehicle_id')
  then
    raise exception '0064: shipment.vehicle_id eklenmemiş.';
  end if;

  -- ⚠️ CCP-8 ZATEN sevkiyata bağlanabiliyor mu? Bu göçün gerekçesi buydu;
  -- 0024 değişmişse yeni kolon açma kararı yeniden düşünülmeli.
  if not exists (
    select 1 from public.haccp_ccp where code = 'CCP-8' and stage = 'DISPATCH'
  ) then
    raise notice '0064: CCP-8 bulunamadı — 0024 uygulanmamış olabilir.';
  end if;

  -- Silme kapısı kapalı mı?
  if has_table_privilege('authenticated', 'public.vehicle', 'delete') then
    raise exception '0064: vehicle silinebilir durumda — kart pasife alınır, silinmez.';
  end if;

  raise notice '0064 TAMAM · araç ve şoför kartları açıldı, sevkiyata bağlandı';
end $$;
