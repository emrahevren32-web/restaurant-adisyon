-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0043 · Lisans defteri, platform muafiyeti ve süre talebi kararı
--
-- Üç kusur kapatılıyor (hepsi Emrah'ın canlı denemesinden çıktı):
--
-- 1. PLATFORMUN LİSANSI YOK. MİYOP kiracısına da lisans açılmıştı ve
--    Emrah kendi ekranında "30 gün kaldı" gördü. Lisans MÜŞTERİ içindir;
--    kendi kendine lisans satan bir platform saçmadır.
--
-- 2. UZATMA GEÇMİŞİ KAYBOLUYORDU. `lisansi_uzat` bitiş tarihini ÜSTÜNE
--    yazıyordu: "kaç kez uzattık, toplam kaç gün verdik" sorusunun cevabı
--    hiçbir yerde yoktu. Çözüm her zamanki kalıp: APPEND-ONLY DEFTER.
--    (ADR-001. Altıncı kez aynı şey.)
--
-- 3. SÜRE TALEBİNE KARAR VERİLEMİYORDU. Müşteri talebi açıyordu ama
--    onaylama/reddetme yolu yoktu; talep bir kuyu gibiydi.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Platform kiracısı işaretleniyor ──────────────────────────────────
alter table tenant add column if not exists is_platform boolean not null default false;

comment on column tenant.is_platform is
  'MİYOP''un kendi kiracısı. Lisans, abonelik ve süre kuralları bu kiracıya '
  'UYGULANMAZ; platform kendi kendine lisans satmaz.';

-- Ölçüt uydurulmuyor: platform kiracısı, içinde `platform.manage` izni olan
-- bir kullanıcı bulunan kiracıdır. (Aynı ölçüt uygulamada da kullanılıyor:
-- src/App.tsx · isPlatformAdminUser)
update tenant t
   set is_platform = true
 where exists (
   select 1
     from app_user u
     join role_permission rp
       on rp.role_code = u.role_code
      or exists (select 1 from user_role ur
                  where ur.user_id = u.id and ur.role_code = rp.role_code)
    where u.tenant_id = t.id
      and rp.permission_code = 'platform.manage'
 );

-- Platformun lisansı varsa kaldırılıyor. Silmek burada doğru: bu satır bir
-- geçmiş değil, bir HATAYDI.
delete from tenant_license l
 using tenant t
 where t.id = l.tenant_id and t.is_platform;

-- ── 2 · Lisans defteri (append-only) ─────────────────────────────────────
create table if not exists license_event (
  id          bigserial primary key,
  tenant_id   uuid not null references tenant(id),
  license_id  uuid references tenant_license(id),
  kind        text not null
                check (kind in ('ACILDI','UZATILDI','ASKIYA_ALINDI','SURDURULDU',
                                'IPTAL','SURE_TALEBI','TALEP_ONAYLANDI','TALEP_REDDEDILDI')),
  old_end     date,
  new_end     date,
  -- Eklenen gün: "toplam kaç gün lisans kullandılar" bu kolonun toplamıdır.
  added_days  integer,
  actor_id    uuid references app_user(id),
  actor_name  text,
  note        text,
  created_at  timestamptz not null default now()
);

comment on table license_event is
  'Lisansın hayat defteri. Yalnız EKLENİR. "Kaç kez uzatıldı, toplam kaç gün '
  'verildi, kim uzattı" sorularının tek kaynağı budur.';

create index if not exists license_event_tenant_ix
  on license_event (tenant_id, created_at desc);

create or replace function app.lisans_defteri_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Lisans defteri değiştirilemez ve silinemez.' using errcode = 'MI403';
end $$;

drop trigger if exists license_event_degismez on license_event;
create trigger license_event_degismez
  before update or delete on license_event
  for each row execute function app.lisans_defteri_degismez();

alter table license_event enable row level security;

drop policy if exists license_event_okuma on license_event;
create policy license_event_okuma on license_event
  for select using (tenant_id = app.current_tenant_id());

revoke all on license_event from anon, authenticated;
grant select on license_event to authenticated;
grant select, insert on license_event to service_role;
revoke all on sequence license_event_id_seq from anon, authenticated;

-- ── 3 · Deftere yazan yardımcı ───────────────────────────────────────────
create or replace function app.lisans_olayi_yaz(
  p_tenant uuid, p_lisans uuid, p_kind text,
  p_eski date default null, p_yeni date default null, p_not text default null
)
returns void
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_user uuid; v_ad text;
begin
  select user_id, ad into v_user, v_ad from app.denetim_aktoru();
  insert into license_event (tenant_id, license_id, kind, old_end, new_end,
                             added_days, actor_id, actor_name, note)
  values (p_tenant, p_lisans, p_kind, p_eski, p_yeni,
          case when p_eski is not null and p_yeni is not null
               then (p_yeni - p_eski) end,
          v_user, v_ad, p_not);
end $$;

-- ── 4 · Lisans açma: platformu atla + deftere yaz ────────────────────────
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
  v_bitis   date;
begin
  -- ⚠️ PLATFORMA LİSANS AÇILMAZ (0043).
  if exists (select 1 from tenant where id = p_tenant and is_platform) then
    return null;
  end if;

  select id into v_id from tenant_license
   where tenant_id = p_tenant and status in ('Deneme','Aktif') limit 1;
  if v_id is not null then return v_id; end if;

  select * into v_paket from license_package
   where is_active and sector_id = v_sektor order by created_at limit 1;
  if not found then
    select * into v_paket from license_package
     where is_active and sector_id is null order by created_at limit 1;
  end if;
  if not found then
    raise exception 'Lisans paketi bulunamadı; 0042 tohum verisi eksik.'
      using errcode = 'MI404';
  end if;

  v_bitis := current_date + make_interval(days => v_paket.trial_days);

  insert into tenant_license (tenant_id, package_id, license_key, status,
                              start_date, end_date, is_trial, note)
  values (p_tenant, v_paket.id, app.lisans_anahtari_uret(), 'Deneme',
          current_date, v_bitis, true, 'Başvuru onayıyla açıldı')
  returning id into v_id;

  perform app.lisans_olayi_yaz(p_tenant, v_id, 'ACILDI',
                               current_date, v_bitis, 'Deneme lisansı açıldı');
  return v_id;
end $$;

-- ── 5 · Uzatma: deftere yaz ──────────────────────────────────────────────
create or replace function app.lisansi_uzat(
  p_tenant uuid, p_yeni_bitis date default null,
  p_ay integer default null, p_not text default null
)
returns tenant_license
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_lisans tenant_license%rowtype;
  v_eski   date;
  v_bitis  date;
begin
  select * into v_lisans from tenant_license
   where tenant_id = p_tenant and status in ('Deneme','Aktif') limit 1;
  if not found then
    select * into v_lisans from tenant_license
     where tenant_id = p_tenant order by end_date desc limit 1;
    if not found then
      raise exception 'Bu kiracının lisansı yok.' using errcode = 'MI404';
    end if;
  end if;

  v_eski := v_lisans.end_date;

  if p_yeni_bitis is not null then
    v_bitis := p_yeni_bitis;
  elsif p_ay is not null then
    v_bitis := greatest(v_lisans.end_date, current_date) + make_interval(months => p_ay);
  else
    raise exception 'Uzatma için ya yeni bitiş tarihi ya da ay sayısı gerekir.'
      using errcode = 'MI400';
  end if;

  if v_bitis <= current_date then
    raise exception 'Yeni bitiş tarihi bugünden ileride olmalı.' using errcode = 'MI400';
  end if;

  update tenant_license
     set end_date = v_bitis, status = 'Aktif', is_trial = false,
         note = coalesce(p_not, note), updated_at = now()
   where id = v_lisans.id
   returning * into v_lisans;

  perform app.lisans_olayi_yaz(p_tenant, v_lisans.id, 'UZATILDI',
                               v_eski, v_bitis, p_not);
  return v_lisans;
end $$;

-- ── 6 · Süre talebine karar ──────────────────────────────────────────────
create or replace function public.sure_talebini_karara_bagla(
  p_talep uuid,
  p_onay  boolean,
  p_ay    integer default 1,
  p_not   text default null
)
returns license_extension_request
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_talep license_extension_request%rowtype;
  v_user  uuid;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Süre talebini karara bağlama yetkiniz yok.' using errcode = 'MI403';
  end if;

  select * into v_talep from license_extension_request where id = p_talep;
  if not found then
    raise exception 'Talep bulunamadı.' using errcode = 'MI404';
  end if;
  if v_talep.status <> 'Bekliyor' then
    raise exception 'Bu talep zaten karara bağlanmış (%).', v_talep.status
      using errcode = 'MI409';
  end if;

  select user_id into v_user from app.denetim_aktoru();

  update license_extension_request
     set status = case when p_onay then 'Onaylandı' else 'Reddedildi' end,
         decided_by = v_user, decided_at = now(), decision_note = p_not
   where id = p_talep
   returning * into v_talep;

  if p_onay then
    perform app.lisansi_uzat(v_talep.tenant_id, null, coalesce(p_ay, 1),
                             coalesce(p_not, 'Süre talebi onaylandı'));
    perform app.lisans_olayi_yaz(v_talep.tenant_id, null, 'TALEP_ONAYLANDI',
                                 null, null, p_not);
  else
    perform app.lisans_olayi_yaz(v_talep.tenant_id, null, 'TALEP_REDDEDILDI',
                                 null, null, p_not);
  end if;

  return v_talep;
end $$;

revoke all on function public.sure_talebini_karara_bagla(uuid, boolean, integer, text) from public, anon;
grant execute on function public.sure_talebini_karara_bagla(uuid, boolean, integer, text)
  to authenticated, service_role;

-- Talep açılınca deftere düşsün (müşteri tarafından).
create or replace function app.sure_talebi_deftere()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  perform app.lisans_olayi_yaz(new.tenant_id, null, 'SURE_TALEBI',
                               null, null, new.reason);
  return null;
end $$;

drop trigger if exists ler_deftere on license_extension_request;
create trigger ler_deftere
  after insert on license_extension_request
  for each row execute function app.sure_talebi_deftere();

-- ── 7 · Platformun göreceği liste ────────────────────────────────────────
-- RLS her kiracıyı kendi satırına kilitliyor; platformun hepsini görmesi
-- gerekiyor. Bu yüzden `security definer` bir fonksiyon — ve ilk satırı
-- yetki kontrolü.
create or replace function public.lisans_ozeti()
returns table (
  tenant_id uuid, kiraci_kodu text, isletme text, paket text,
  durum text, baslangic date, bitis date, kalan_gun integer,
  uzatma_sayisi integer, toplam_gun integer, bekleyen_talep boolean
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Lisans listesini görme yetkiniz yok.' using errcode = 'MI403';
  end if;

  return query
  select t.id,
         t.code,
         coalesce(c.company_name, t.name),
         p.name,
         l.status,
         l.start_date,
         l.end_date,
         (l.end_date - current_date)::int,
         (select count(*)::int from license_event e
           where e.tenant_id = t.id and e.kind = 'UZATILDI'),
         -- Toplam gün: ilk açılıştan bugünkü bitişe kadar verilen süre.
         (l.end_date - l.start_date)::int,
         exists (select 1 from license_extension_request r
                  where r.tenant_id = t.id and r.status = 'Bekliyor')
    from tenant t
    join tenant_license l on l.tenant_id = t.id and l.status in ('Deneme','Aktif')
    left join company c on c.tenant_id = t.id
    join license_package p on p.id = l.package_id
   where not t.is_platform
   order by l.end_date;
end $$;

revoke all on function public.lisans_ozeti() from public, anon;
grant execute on function public.lisans_ozeti() to authenticated, service_role;

-- Bekleyen talepler (platform için)
create or replace function public.sure_talepleri()
returns table (
  id uuid, tenant_id uuid, isletme text, gerekce text,
  durum text, istenme timestamptz, karar_notu text, bitis date
)
language plpgsql security definer set search_path = public, app, pg_temp as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Süre taleplerini görme yetkiniz yok.' using errcode = 'MI403';
  end if;

  return query
  select r.id, r.tenant_id, coalesce(c.company_name, t.name),
         r.reason, r.status, r.requested_at, r.decision_note, l.end_date
    from license_extension_request r
    join tenant t on t.id = r.tenant_id
    left join company c on c.tenant_id = t.id
    left join tenant_license l on l.tenant_id = t.id and l.status in ('Deneme','Aktif')
   order by (r.status = 'Bekliyor') desc, r.requested_at desc;
end $$;

revoke all on function public.sure_talepleri() from public, anon;
grant execute on function public.sure_talepleri() to authenticated, service_role;

notify pgrst, 'reload schema';

-- ── DOĞRULAMA ────────────────────────────────────────────────────────────
do $$
declare
  v_platform int; v_platform_lisans int; v_olay int;
begin
  select count(*) into v_platform from tenant where is_platform;
  if v_platform = 0 then
    raise warning '0043: platform kiracısı işaretlenemedi (platform.manage izinli kullanıcı yok mu?).';
  end if;

  select count(*) into v_platform_lisans
    from tenant_license l join tenant t on t.id = l.tenant_id where t.is_platform;
  if v_platform_lisans > 0 then
    raise exception '0043: platform kiracısında hâlâ lisans var (%).', v_platform_lisans;
  end if;

  -- Defter gerçekten değişmez mi?
  begin
    -- ⚠️ Sınama satırı HERHANGİ bir kiracıyla yazılır. İlk yazdığımda
    -- "platform olmayan kiracı" aramıştım; göç sırası gereği o an sistemde
    -- yalnızca MİYOP vardı ve doğrulama, kod doğruyken kırmızıya düştü.
    -- Doğrulama, sınadığı şeyin dışındaki bir varsayıma dayanmamalı.
    insert into license_event (tenant_id, kind, note)
    select id, 'ACILDI', '0043 sınaması' from tenant limit 1;
    select count(*) into v_olay from license_event where note = '0043 sınaması';
    if v_olay <> 1 then raise exception '0043: deftere yazılamadı.'; end if;
    begin
      update license_event set note = 'değiştirildi' where note = '0043 sınaması';
      raise exception '0043: DEFTER DEĞİŞTİRİLEBİLİYOR — koruma çalışmıyor.';
    exception when sqlstate 'MI403' then null;
    end;
  end;

  raise notice '0043 TAMAM · platform kiracısı % · platform lisansı 0 · defter değişmez',
    v_platform;
end $$;
