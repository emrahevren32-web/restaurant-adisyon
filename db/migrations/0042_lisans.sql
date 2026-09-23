-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · A4D madde 3 · Lisans veritabanına taşınıyor
--
-- ── NEDEN ────────────────────────────────────────────────────────────────
-- Onay bugün kiracıyı, firmayı ve şubeyi Postgres'te açıyor; LİSANSI
-- açmıyor. "Bu müşteri hangi paketi aldı, hangi modülleri kullanabilir, ne
-- zamana kadar" bilgisi hâlâ tarayıcı hafızasında (`ra_company_licenses`).
-- Tarayıcı temizlenince kayboluyor.
--
-- Para alınacak gün ilk güvenilmesi gereken kayıt budur. Tarayıcıda duran
-- bir lisans, lisans değildir.
--
-- ── ÜÇ TABLO, İKİ DÜNYA ──────────────────────────────────────────────────
--   license_package         → ÜRÜNÜN tanımı. Kiracıya ait değil, MİYOP'a ait.
--   license_package_module  → paketin açtığı modüller
--   tenant_license          → KİRACIYA ait: hangi paket, ne zamana kadar
--
-- İlk ikisi referans veri: bütün kiracılar okur, kimse yazamaz. Üçüncüsü
-- kiracı verisi: herkes YALNIZ kendisininkini görür (RLS).
--
-- ⚠️ RLS ve GRANT AYRI KAPILARDIR (tuzak 1). İkisi de aşağıda.
--
-- ── LİSANSI KİM YAZAR ────────────────────────────────────────────────────
-- Müşteri değil. Hiçbir kiracıya insert/update yetkisi verilmiyor; lisansı
-- ya onay akışı (tetikleyici, `security definer`) ya da platform `service_role`
-- ile yazar. Kendi lisansını uzatabilen müşteri, lisanssız müşteridir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Paket (ürünün kendi tanımı) ───────────────────────────────────────
create table if not exists license_package (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  description   text,
  -- Sektörü olan paket o sektörün varsayılanıdır; boş olan paket geneldir.
  sector_id     text,
  monthly_price numeric(12,2) not null default 0,
  yearly_price  numeric(12,2) not null default 0,
  -- ⚠️ NULL = SINIRSIZ (Emrah kararı, 2026-09-23): "hepsini yapabilsin,
  -- müşteri yeteneğimizi görsün". Sayı yazmak teknik bir sınırımız varmış
  -- gibi göstermek olurdu; yok.
  max_users     integer,
  max_branches  integer,
  trial_days    integer not null default 30 check (trial_days >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table license_package is
  'Satılan paketler. MİYOP''un kendi referans verisi; kiracıya ait değil, '
  'yedeğe de girmez.';

create table if not exists license_package_module (
  package_id  uuid not null references license_package(id) on delete cascade,
  module_key  text not null,
  primary key (package_id, module_key)
);

comment on table license_package_module is
  'Paketin açtığı modüller. Anahtarlar uygulamadaki LicenseModuleKey ile aynı '
  'yazımda tutulur (stock, recipe, purchase…).';

-- ── 2 · Kiracının lisansı ────────────────────────────────────────────────
create table if not exists tenant_license (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id),
  package_id    uuid not null references license_package(id),
  license_key   text not null unique,
  status        text not null default 'Deneme'
                  check (status in ('Deneme','Aktif','Süresi Doldu','Askıya Alındı','İptal Edildi')),
  start_date    date not null default current_date,
  end_date      date not null,
  is_trial      boolean not null default true,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Bitiş başlangıçtan önce olamaz. Bu kontrol olmasa "dün bitmiş" bir
  -- lisans yazılabilir ve müşteri kapıda kalırdı.
  constraint tenant_license_tarih_sirasi check (end_date >= start_date)
);

comment on table tenant_license is
  'Kiracının lisansı. Geçmiş satırlar DURUR (yenileme geçmişi); aynı anda '
  'yalnız bir tanesi yürürlükte olabilir.';

-- Aynı anda tek yürürlükteki lisans. Yenilenen eski satır "Süresi Doldu"ya
-- çekilir, silinmez — geçmiş kaybolmaz.
create unique index if not exists tenant_license_tek_yururluk
  on tenant_license (tenant_id)
  where status in ('Deneme', 'Aktif');

create index if not exists tenant_license_tenant_ix
  on tenant_license (tenant_id, end_date desc);

-- ── 3 · Başlangıç paketleri ──────────────────────────────────────────────
-- Fiyatlar 0: fiyat kararı henüz verilmedi (yol haritası "karar bekleyen üç
-- konu"). Sıfır fiyat yazmak, uydurma fiyat yazmaktan dürüsttür.
insert into license_package (code, name, description, sector_id, trial_days, max_users, max_branches)
values
  ('endustriyel-mutfak-baslangic', 'Endüstriyel Mutfak · Başlangıç',
   'Depo, stok, reçete, üretim, satın alma ve cari modülleriyle endüstriyel mutfak paketi.',
   'sector_industrial_kitchen', 30, null, null),
  ('genel-baslangic', 'Genel · Başlangıç',
   'Sektörü belirlenmemiş işletmeler için çekirdek paket.',
   null, 30, null, null)
on conflict (code) do nothing;

insert into license_package_module (package_id, module_key)
select p.id, m.k
from license_package p
cross join (values ('stock'),('recipe'),('purchase'),('current'),('multi-branch')) as m(k)
where p.code = 'endustriyel-mutfak-baslangic'
on conflict do nothing;

insert into license_package_module (package_id, module_key)
select p.id, m.k
from license_package p
cross join (values ('stock'),('current')) as m(k)
where p.code = 'genel-baslangic'
on conflict do nothing;

-- ── 4 · Lisans anahtarı ──────────────────────────────────────────────────
-- Okunabilir ve tekrarlanamaz: MIY-LIS-XXXXXXXX.
-- ⚠️ 2026-09-23 · CANLIDA DÜŞTÜ: `gen_random_bytes` pgcrypto'dan gelir ve
-- Supabase pgcrypto'yu `extensions` şemasına kurar. Fonksiyonun arama yolunda
-- o şema yoktu: "function gen_random_bytes(integer) does not exist".
-- Yerel provada geçmişti çünkü prova pgcrypto'yu `public` içine kuruyordu —
-- provanın kendisi yanlış kurulmuştu (düzeltildi).
-- `gen_random_uuid` PostgreSQL'in ÇEKİRDEĞİNDE; eklentiye bağlı değil.
create or replace function app.lisans_anahtari_uret()
returns text
language plpgsql volatile
set search_path = public, app, pg_temp as $$
declare
  v_anahtar text;
begin
  loop
    v_anahtar := 'MIY-LIS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from tenant_license where license_key = v_anahtar);
  end loop;
  return v_anahtar;
end $$;

-- ── 5 · Kiracıya lisans aç ───────────────────────────────────────────────
create or replace function app.kiraci_lisansi_ac(
  p_tenant uuid,
  p_sektor text default null
)
returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_paket   license_package%rowtype;
  v_sektor  text := app.sektor_kimligi(p_sektor);
  v_id      uuid;
begin
  -- Zaten yürürlükte lisansı varsa dokunma. (Onay iki kez çalışırsa ikinci
  -- lisans doğmasın; kısmi benzersiz indeks zaten reddederdi ama hatayla
  -- değil, sessizce geçmek doğrusu.)
  select id into v_id from tenant_license
   where tenant_id = p_tenant and status in ('Deneme','Aktif') limit 1;
  if v_id is not null then return v_id; end if;

  -- Sektörün paketi varsa o, yoksa genel paket.
  select * into v_paket from license_package
   where is_active and sector_id = v_sektor
   order by created_at limit 1;
  if not found then
    select * into v_paket from license_package
     where is_active and sector_id is null
     order by created_at limit 1;
  end if;
  if not found then
    raise exception 'Lisans paketi bulunamadı; 0042 tohum verisi eksik.'
      using errcode = 'MI404';
  end if;

  insert into tenant_license (tenant_id, package_id, license_key, status,
                              start_date, end_date, is_trial, note)
  values (p_tenant, v_paket.id, app.lisans_anahtari_uret(), 'Deneme',
          current_date, current_date + make_interval(days => v_paket.trial_days),
          true, 'Başvuru onayıyla açıldı')
  returning id into v_id;

  return v_id;
end $$;

comment on function app.kiraci_lisansi_ac(uuid, text) is
  'Kiracıya deneme lisansı açar. Yürürlükte lisans varsa hiçbir şey yapmaz.';

-- ── 6 · Onay akışına bağlanma ────────────────────────────────────────────
-- ⚠️ `basvuruyu_onayla` fonksiyonuna DOKUNULMUYOR. Kural fonksiyonda değil
-- TABLODA: firmayı kim yaratırsa yaratsın (onay, demo betiği, elle insert)
-- lisans da doğar. Tuzak 35: başka tabloya yazmak AFTER'ın işidir.
create or replace function app.firma_dogunca_lisans_ac()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  perform app.kiraci_lisansi_ac(new.tenant_id, new.primary_sector_id);
  return null;
end $$;

drop trigger if exists company_lisans_ac on company;
create trigger company_lisans_ac
  after insert on company
  for each row execute function app.firma_dogunca_lisans_ac();

-- ── 7 · Var olan kiracılar ───────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select t.id, c.primary_sector_id
             from tenant t
             left join company c on c.tenant_id = t.id
            where not exists (select 1 from tenant_license l
                               where l.tenant_id = t.id and l.status in ('Deneme','Aktif'))
  loop
    perform app.kiraci_lisansi_ac(r.id, r.primary_sector_id);
  end loop;
end $$;

-- ── 8 · Erişim ───────────────────────────────────────────────────────────
-- Paket tanımları: herkes okur (müşteri "hangi paketteyim" diyebilsin),
-- kimse yazamaz.
alter table license_package enable row level security;
alter table license_package_module enable row level security;

drop policy if exists license_package_okuma on license_package;
create policy license_package_okuma on license_package
  for select using (true);

drop policy if exists license_package_module_okuma on license_package_module;
create policy license_package_module_okuma on license_package_module
  for select using (true);

revoke all on license_package from anon, authenticated;
revoke all on license_package_module from anon, authenticated;
grant select on license_package to authenticated;
grant select on license_package_module to authenticated;
grant select, insert, update on license_package to service_role;
grant select, insert, update on license_package_module to service_role;

-- Kiracının lisansı: yalnız kendi satırı, yalnız OKUMA.
alter table tenant_license enable row level security;

drop policy if exists tenant_license_okuma on tenant_license;
create policy tenant_license_okuma on tenant_license
  for select using (tenant_id = app.current_tenant_id());

-- Yazma politikası YOK. Müşteri kendi lisansını uzatamaz.
revoke all on tenant_license from anon, authenticated;
grant select on tenant_license to authenticated;
grant select, insert, update on tenant_license to service_role;

-- ── 9 · Denetim ──────────────────────────────────────────────────────────
-- "Lisansı kim uzattı, kim askıya aldı" sorusunun cevabı kayıtta olmalı.
drop trigger if exists denetim_tenant_license on tenant_license;
create trigger denetim_tenant_license
  after insert or update or delete on tenant_license
  for each row execute function app.denetim_yaz();

-- ── 9B · Lisansı uzatma (YALNIZ PLATFORM) ────────────────────────────────
-- Emrah kararı: süreyi biz uzatırız — ya tarih vererek ya da ay ekleyerek.
-- Müşteri kendi lisansını uzatamaz; bu yüzden tabloya değil FONKSİYONA yetki
-- veriliyor ve fonksiyon yetkiyi kendisi sınıyor.
create or replace function app.lisansi_uzat(
  p_tenant     uuid,
  p_yeni_bitis date default null,
  p_ay         integer default null,
  p_not        text default null
)
returns tenant_license
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_lisans tenant_license%rowtype;
  v_bitis  date;
begin
  select * into v_lisans from tenant_license
   where tenant_id = p_tenant and status in ('Deneme','Aktif')
   limit 1;

  -- Yürürlükte lisans yoksa süresi dolmuş SON lisansı canlandırıyoruz;
  -- yeni satır açmak geçmişi ikizler.
  if not found then
    select * into v_lisans from tenant_license
     where tenant_id = p_tenant
     order by end_date desc limit 1;
    if not found then
      raise exception 'Bu kiracının lisansı yok.' using errcode = 'MI404';
    end if;
  end if;

  if p_yeni_bitis is not null then
    v_bitis := p_yeni_bitis;
  elsif p_ay is not null then
    -- Süresi geçmişse BUGÜNDEN, geçmemişse bitişten uzatılır. Geçmiş bir
    -- tarihe ay eklemek, uzatmayı ilk günden yer.
    v_bitis := greatest(v_lisans.end_date, current_date) + make_interval(months => p_ay);
  else
    raise exception 'Uzatma için ya yeni bitiş tarihi ya da ay sayısı gerekir.'
      using errcode = 'MI400';
  end if;

  if v_bitis <= current_date then
    raise exception 'Yeni bitiş tarihi bugünden ileride olmalı.' using errcode = 'MI400';
  end if;

  update tenant_license
     set end_date   = v_bitis,
         status     = 'Aktif',
         is_trial   = false,
         note       = coalesce(p_not, note),
         updated_at = now()
   where id = v_lisans.id
   returning * into v_lisans;

  return v_lisans;
end $$;

-- ⚠️ PostgREST yalnız `public` şemasını yayınlar (tuzak: 0012→0016, 0038, 0039).
create or replace function public.lisansi_uzat(
  p_tenant     uuid,
  p_yeni_bitis date default null,
  p_ay         integer default null,
  p_not        text default null
)
returns tenant_license
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Lisans uzatma yetkiniz yok.' using errcode = 'MI403';
  end if;
  return app.lisansi_uzat(p_tenant, p_yeni_bitis, p_ay, p_not);
end $$;

revoke all on function public.lisansi_uzat(uuid, date, integer, text) from public, anon;
grant execute on function public.lisansi_uzat(uuid, date, integer, text)
  to authenticated, service_role;

-- ── 9C · Süre uzatma TALEBİ (müşteriden bize) ────────────────────────────
-- Emrah kararı: lisans bitince müşteri ek süre TALEP edebilsin, ama süre
-- ancak BİZİM onayımızla uzasın. Talep bir istek kaydıdır; kendi kendine
-- hiçbir şeyi uzatmaz.
create table if not exists license_extension_request (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default app.current_tenant_id() references tenant(id),
  requested_by uuid references app_user(id),
  requested_at timestamptz not null default now(),
  reason       text,
  status       text not null default 'Bekliyor'
                 check (status in ('Bekliyor','Onaylandı','Reddedildi')),
  decided_by   uuid references app_user(id),
  decided_at   timestamptz,
  decision_note text
);

comment on table license_extension_request is
  'Müşterinin ek süre talebi. Talep lisansı UZATMAZ; yalnız platformdan '
  'uzatma ister. Karar `public.lisansi_uzat` ile ayrıca verilir.';

-- Aynı anda tek bekleyen talep: müşteri arka arkaya basınca kuyruk şişmesin.
create unique index if not exists license_extension_request_tek_bekleyen
  on license_extension_request (tenant_id) where status = 'Bekliyor';

alter table license_extension_request enable row level security;

drop policy if exists ler_okuma on license_extension_request;
create policy ler_okuma on license_extension_request
  for select using (tenant_id = app.current_tenant_id());

-- ⚠️ `tenant_id` ve `requested_by` KOLON VARSAYILANINDAN dolar ve yazma
-- yetkisinin DIŞINDA kalır (0030'daki kalıp): müşteri talebi başkasının
-- üstüne yazamaz.
drop policy if exists ler_yazma on license_extension_request;
create policy ler_yazma on license_extension_request
  for insert with check (tenant_id = app.current_tenant_id());

revoke all on license_extension_request from anon, authenticated;
grant select on license_extension_request to authenticated;
grant insert (reason) on license_extension_request to authenticated;
grant select, insert, update on license_extension_request to service_role;

drop trigger if exists denetim_license_extension_request on license_extension_request;
create trigger denetim_license_extension_request
  after insert or update or delete on license_extension_request
  for each row execute function app.denetim_yaz();

-- ── 10 · API önbelleği ───────────────────────────────────────────────────
-- Tuzak 31: yeni tablo PostgREST'te hemen görünmez.
notify pgrst, 'reload schema';

-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
do $$
declare
  v_paket int; v_modul int; v_lisans int; v_kiracisiz int;
begin
  select count(*) into v_paket from license_package;
  if v_paket < 2 then raise exception '0042: paketler oluşmadı (%).', v_paket; end if;

  select count(*) into v_modul from license_package_module;
  if v_modul < 7 then raise exception '0042: paket modülleri eksik (%).', v_modul; end if;

  -- Lisansı olmayan kiracı kalmamalı
  select count(*) into v_kiracisiz
    from tenant t
   where not exists (select 1 from tenant_license l
                      where l.tenant_id = t.id and l.status in ('Deneme','Aktif'));
  if v_kiracisiz > 0 then
    raise exception '0042: % kiracının lisansı yok.', v_kiracisiz;
  end if;

  select count(*) into v_lisans from tenant_license;

  -- Müşteri yazamamalı
  if has_table_privilege('authenticated', 'tenant_license', 'INSERT')
     or has_table_privilege('authenticated', 'tenant_license', 'UPDATE') then
    raise exception '0042: authenticated rolü lisansa yazabiliyor.';
  end if;

  -- RLS gerçekten açık mı
  if not (select relrowsecurity from pg_class where oid = 'public.tenant_license'::regclass) then
    raise exception '0042: tenant_license üzerinde RLS kapalı.';
  end if;

  -- Uzatma gerçekten uzatıyor mu? (Sınama için bir kiracı seç, uzat, geri al.)
  declare
    v_t uuid; v_eski date; v_yeni date;
  begin
    select tenant_id, end_date into v_t, v_eski from tenant_license
     where status in ('Deneme','Aktif') limit 1;
    if v_t is not null then
      select end_date into v_yeni from app.lisansi_uzat(v_t, null, 1, '0042 sınaması');
      if v_yeni <= v_eski then
        raise exception '0042: uzatma bitiş tarihini ileri almadı (% → %).', v_eski, v_yeni;
      end if;
      update tenant_license set end_date = v_eski, status = 'Deneme', is_trial = true,
                                note = 'Başvuru onayıyla açıldı'
       where tenant_id = v_t and status = 'Aktif';
    end if;
  end;

  raise notice '0042 TAMAM · % paket · % modül · % lisans · yazma kapalı · RLS açık',
    v_paket, v_modul, v_lisans;
end $$;
