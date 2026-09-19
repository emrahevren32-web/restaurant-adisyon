-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4D / KAPI
-- 0032 — Başvuru defteri: "başvurdum" demek bir kayıt bırakmalı
--
-- Demonun 1. perdesi: başvuru → onay → hesap → giriş. Bugün bu zincirin
-- tamamı TARAYICI HAFIZASINDA çalışıyor (`storage.ts`). Yani başvuru
-- sekmeyi kapatınca kayboluyor, onay başka bir bilgisayardan görünmüyor.
-- Bir demoda ilk görülen şeyin en kırılgan parça olması kabul edilemez.
--
-- ── BU TABLO KİRACIYA AİT DEĞİL ──────────────────────────────────────────
-- Bütün diğer tablolarımızda `tenant_id` var ve RLS onunla süzer (ADR-004).
-- Burada olamaz: **başvuru, kiracı VAR OLMADAN ÖNCE doğar.** Kiracı ancak
-- onaydan sonra oluşur. Bu yüzden `tenant_id` kolonu var ama BOŞ başlar ve
-- onayda dolar — başvurunun hangi işletmeye dönüştüğünü gösterir.
--
-- Sonuç: izolasyon burada kiracıyla değil İZİNLE kurulur. Başvuruları
-- yalnızca `platform.manage` izni olan (MİYOP personeli) görür.
--
-- ── ANONİM YAZMA: SİSTEMDEKİ TEK YER ─────────────────────────────────────
-- Form oturum açmadan doldurulur, yani `anon` rolünün yazması gerekir.
-- Bugüne kadar `anon`a hiçbir tabloda yazma vermedik (0007) ve hata
-- kaydında da bilerek vermedik (0030). Burada vermek zorundayız — kapının
-- kendisi bu.
--
-- Kapıyı daraltan dört şey:
--   1. Kolon listesi dar: `status`, `tenant_id`, `decided_*` YOK. Yani
--      başvuran kendini "onaylanmış" olarak yazamaz.
--   2. Politika ayrıca `status = 'PENDING'` şartı koyuyor — varsayılan
--      değişse bile kapı kapalı kalır. İki bağımsız savunma.
--   3. `anon`a SELECT YOK. Başvurular listelenemez; kimin başvurduğu
--      dışarıdan öğrenilemez.
--   4. Aynı e-postadan AÇIK ikinci başvuru engelli (kısmi tekil dizin).
--
-- ⚠️ DÜRÜST SINIR: bu, kaba kuvvetle doldurmayı tamamen engellemez.
-- Gerçek hız sınırı sunucu önünde olur (A5: Hetzner + ters vekil).
-- Bugünkü koruma "spam imkânsız" değil, "spam işe yaramaz": kayıtlar
-- okunamaz, onaylanamaz, en fazla yer kaplar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── İzin sorgusu ──────────────────────────────────────────────────────────
-- "Bu oturumun şu izni var mı?" Şimdiye kadar politikalarımız yalnız
-- kiracıya bakıyordu; başvuru kiracıya ait olmadığı için izne bakmak
-- gerekiyor. Genel bir yardımcı: sonraki platform tabloları da kullanacak.
create or replace function app.yetkim_var(p_izin text)
returns boolean
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_auth uuid;
  v_var  boolean;
begin
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return false; end if;

  select exists (
    select 1
    from app_user u
    join user_role ur       on ur.user_id  = u.id
    join role_permission rp on rp.role_code = ur.role_code
    where u.auth_user_id = v_auth
      and rp.permission_code = p_izin
  ) into v_var;

  return coalesce(v_var, false);
end $$;

comment on function app.yetkim_var(text) is
  'Oturumdaki kullanıcının verilen izni var mı. Kiracıya ait OLMAYAN '
  'tabloların politikaları bunu kullanır (bkz. business_application).';

-- ── Başvuru ───────────────────────────────────────────────────────────────
create table if not exists business_application (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- PENDING    → form dolduruldu, kimse bakmadı
  -- IN_REVIEW  → MİYOP inceliyor
  -- APPROVED   → kiracı oluşturuldu (tenant_id dolar)
  -- REJECTED   → reddedildi, gerekçesi yazılı
  -- CANCELLED  → başvuran vazgeçti / MİYOP iptal etti
  status        text not null default 'PENDING'
                  check (status in ('PENDING','IN_REVIEW','APPROVED','REJECTED','CANCELLED')),

  -- Sektör: hangi modül paketiyle açılacağını belirler (A4D madde 7).
  sector_code   text not null default 'endustriyel-mutfak',

  company_name  text not null check (length(btrim(company_name)) between 2 and 200),
  owner_name    text not null check (length(btrim(owner_name))   between 2 and 120),
  phone         text not null check (length(btrim(phone))        between 7 and 30),
  email         text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  tax_number    text not null check (length(btrim(tax_number))   between 10 and 11),
  tax_office    text not null check (length(btrim(tax_office))   between 2 and 120),
  city          text not null check (length(btrim(city))         between 2 and 60),
  district      text not null check (length(btrim(district))     between 2 and 60),
  address       text not null check (length(btrim(address))      between 5 and 500),
  note          text          check (note is null or length(note) <= 1000),

  -- Karar alanları. ⚠️ `anon` bunlara YAZAMAZ (aşağıdaki dar GRANT).
  decision_note text          check (decision_note is null or length(decision_note) <= 1000),
  decided_at    timestamptz,
  decided_by    uuid references app_user(id) on delete set null,

  -- Onay sonucu: başvuru hangi işletmeye dönüştü.
  tenant_id     uuid references tenant(id) on delete set null,

  -- Karar verilmiş bir başvurunun gerekçesi ve zamanı olmak ZORUNDA.
  -- Gerekçesiz ret, "neden reddedildi" sorusunu cevapsız bırakır.
  constraint business_application_karar_tam check (
    status not in ('APPROVED','REJECTED','CANCELLED')
    or (decided_at is not null and length(btrim(coalesce(decision_note,''))) >= 3)
  ),
  -- Onaylanmış başvurunun kiracısı olmak ZORUNDA. Yoksa "onayladım ama
  -- işletme açılmadı" durumu sessizce oluşur.
  constraint business_application_onay_kiracisiz_olmaz check (
    status <> 'APPROVED' or tenant_id is not null
  )
);

comment on table business_application is
  'İşletme başvuruları. Kiracıya ait DEĞİL — başvuru kiracıdan önce doğar. '
  'İzolasyon platform.manage izniyle kurulur.';

create index if not exists business_application_durum_ix
  on business_application (status, created_at desc);

-- Aynı e-postadan AÇIK ikinci başvuru olmaz. Reddedilmiş ya da iptal
-- edilmiş bir başvurudan sonra tekrar başvurmak SERBEST — kapıyı kalıcı
-- kapatmak yanlış olur.
create unique index if not exists business_application_acik_tekil
  on business_application (lower(btrim(email)))
  where status in ('PENDING','IN_REVIEW');

-- ── Başvuru olay defteri ──────────────────────────────────────────────────
-- Neden ayrı tablo: `audit_log.tenant_id` NOT NULL (0027). Başvurunun
-- kiracısı olmadığı için oraya düşemez. Aynı ilke, kendi defteri.
create table if not exists business_application_event (
  id             bigserial primary key,
  application_id uuid not null references business_application(id) on delete cascade,
  occurred_at    timestamptz not null default now(),
  from_status    text,
  to_status      text not null,
  actor_id       uuid references app_user(id) on delete set null,
  actor_name     text,
  note           text
);

create index if not exists business_application_event_ix
  on business_application_event (application_id, occurred_at);

comment on table business_application_event is
  'Başvurunun durum geçmişi. Sadece eklenir; tetikleyici yazar, uygulama '
  'değil — hiçbir kod yolu atlayamasın.';

-- ── Durum geçişleri: kural VERİTABANINDA ──────────────────────────────────
-- Ekranda da kontrol var ama ekran tek savunma olamaz. Reddedilmiş bir
-- başvuruyu onaylıya çevirmek, elle SQL ile bile mümkün olmamalı.
create or replace function app.basvuru_gecisi()
returns trigger language plpgsql as $$
declare
  v_izinli text[];
begin
  if TG_OP = 'INSERT' then
    if NEW.status <> 'PENDING' then
      raise exception 'Yeni başvuru yalnız PENDING olarak açılır (gelen: %).', NEW.status
        using errcode = 'MI422';
    end if;
    return NEW;
  end if;

  if NEW.status <> OLD.status then
    v_izinli := case OLD.status
      when 'PENDING'   then array['IN_REVIEW','REJECTED','CANCELLED']
      when 'IN_REVIEW' then array['APPROVED','REJECTED','CANCELLED','PENDING']
      else array[]::text[]   -- APPROVED / REJECTED / CANCELLED: son durak
    end;
    if not (NEW.status = any(v_izinli)) then
      raise exception 'Başvuru durumu % -> % yapılamaz.', OLD.status, NEW.status
        using errcode = 'MI422';
    end if;
  end if;

  -- Onaylanmış bir başvurunun kiracısı DEĞİŞTİRİLEMEZ. Yoksa bir
  -- başvurunun sonucu sessizce başka bir işletmeye bağlanabilir.
  if OLD.status = 'APPROVED' and OLD.tenant_id is distinct from NEW.tenant_id then
    raise exception 'Onaylanmış başvurunun işletmesi değiştirilemez.'
      using errcode = 'MI403';
  end if;

  NEW.updated_at := now();
  return NEW;
end $$;

-- ⚠️ OLAY KAYDI **AFTER** TETİKLEYİCİSİNDE YAZILIR — BEFORE'DA YAZILAMAZ.
-- İlk yazdığımda BEFORE INSERT içindeydi ve göç düştü:
--   "insert or update on table business_application_event violates
--    foreign key constraint ... Key (application_id)=(...) is not present"
-- Sebep basit ve unutulması kolay: BEFORE INSERT çalışırken başvuru satırı
-- HENÜZ YAZILMAMIŞTIR. NEW.id vardır ama tabloda karşılığı yoktur; yabancı
-- anahtar haklı olarak reddeder.
--
-- Kural: BEFORE doğrular ve NEW'i düzeltir; BAŞKA TABLOYA YAZMAK AFTER'ın işi.
create or replace function app.basvuru_olayi_yaz()
returns trigger language plpgsql as $$
declare
  v_ad  text;
  v_kim uuid;
begin
  if TG_OP = 'UPDATE' and NEW.status = OLD.status then
    return null;   -- durum değişmediyse olay yok
  end if;

  select user_id, ad into v_kim, v_ad from app.denetim_aktoru();

  insert into business_application_event
    (application_id, from_status, to_status, actor_id, actor_name, note)
  values (
    NEW.id,
    case when TG_OP = 'INSERT' then null else OLD.status end,
    NEW.status, v_kim, v_ad,
    nullif(btrim(coalesce(NEW.decision_note, '')), '')
  );

  return null;   -- AFTER tetikleyicisinin dönüş değeri yok sayılır
end $$;

drop trigger if exists business_application_gecis on business_application;
create trigger business_application_gecis
  before insert or update on business_application
  for each row execute function app.basvuru_gecisi();

drop trigger if exists business_application_olay on business_application;
create trigger business_application_olay
  after insert or update on business_application
  for each row execute function app.basvuru_olayi_yaz();

-- Olay defteri değişmez.
create or replace function app.basvuru_olayi_degismez()
returns trigger language plpgsql as $$
begin
  raise exception 'Başvuru olay kaydı değiştirilemez ve silinemez.'
    using errcode = 'MI403';
end $$;

drop trigger if exists business_application_event_degismez on business_application_event;
create trigger business_application_event_degismez
  before update or delete on business_application_event
  for each row execute function app.basvuru_olayi_degismez();

-- ── Erişim ────────────────────────────────────────────────────────────────
-- ⚠️ RLS ve GRANT ayrı kapılar (0006). İkisi de gerekli.
alter table business_application       enable row level security;
alter table business_application_event enable row level security;

-- Okuma ve karar: yalnızca platform yetkilisi.
drop policy if exists business_application_platform_okuma on business_application;
create policy business_application_platform_okuma on business_application
  for select using (app.yetkim_var('platform.manage'));

drop policy if exists business_application_platform_karar on business_application;
create policy business_application_platform_karar on business_application
  for update using (app.yetkim_var('platform.manage'))
         with check (app.yetkim_var('platform.manage'));

-- Anonim başvuru: SADECE ekleme, SADECE PENDING.
-- Politika `status`a da bakıyor; kolon GRANT'ı zaten status'u dışarıda
-- bırakıyor. İki bağımsız savunma, çünkü biri ileride gevşerse diğeri
-- kapıyı kapalı tutar.
drop policy if exists business_application_acik_basvuru on business_application;
create policy business_application_acik_basvuru on business_application
  for insert with check (status = 'PENDING');

drop policy if exists business_application_event_okuma on business_application_event;
create policy business_application_event_okuma on business_application_event
  for select using (app.yetkim_var('platform.manage'));

revoke all on business_application       from anon, authenticated;
revoke all on business_application_event from anon, authenticated;

-- ⚠️ DAR KOLON LİSTESİ. status / tenant_id / decided_* burada YOK:
-- başvuran kendini onaylı yazamaz, kendine kiracı bağlayamaz.
grant insert (sector_code, company_name, owner_name, phone, email,
              tax_number, tax_office, city, district, address, note)
  on business_application to anon, authenticated;

-- ⚠️ DELETE YETKİSİ HİÇ KİMSEYE VERİLMİYOR. Başvuru silinmez: olay
-- defteri değişmez olduğundan `cascade` de çalışmaz. Bir başvurunun izi
-- kalıcıdır — "kim başvurdu, ne oldu" sorusu her zaman cevaplanabilir.
--
-- Platform yetkilisi okur ve karar verir. Satır süzmesini RLS yapıyor;
-- GRANT sadece kapıyı açıyor.
grant select on business_application to authenticated;
grant update (status, decision_note, decided_at, decided_by, tenant_id, updated_at)
  on business_application to authenticated;
grant select on business_application_event to authenticated;
grant usage on sequence business_application_event_id_seq to authenticated;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
do $$
declare
  v_id uuid;
  v_olay int;
  v_pending_disi_red boolean := false;
  v_terminal_red     boolean := false;
  v_gerekcesiz_red   boolean := false;
begin
  -- 1. Normal başvuru açılıyor ve olay defterine düşüyor
  insert into business_application
    (company_name, owner_name, phone, email, tax_number, tax_office,
     city, district, address)
  values ('0032 Dogrulama Gida A.S.', 'Deneme Yetkili', '05321234567',
          'dogrulama-0032@example.com', '1234567890', 'Bornova',
          'İzmir', 'Bornova', 'Deneme adresi 1')
  returning id into v_id;

  select count(*) into v_olay from business_application_event
   where application_id = v_id;
  if v_olay <> 1 then
    raise exception 'Olay defterine düşmedi (beklenen 1, gelen %).', v_olay;
  end if;

  -- 2. PENDING dışında açmak reddediliyor
  begin
    insert into business_application
      (status, company_name, owner_name, phone, email, tax_number, tax_office,
       city, district, address, decision_note, decided_at, tenant_id)
    values ('APPROVED', 'Kestirme A.S.', 'Kotu Niyet', '05321234568',
            'kestirme-0032@example.com', '1234567891', 'Bornova',
            'İzmir', 'Bornova', 'Adres', 'kestirme', now(), null);
  exception when others then v_pending_disi_red := true;
  end;

  -- 3. Gerekçesiz ret reddediliyor
  begin
    update business_application set status = 'REJECTED', decided_at = now()
     where id = v_id;
  exception when others then v_gerekcesiz_red := true;
  end;

  -- 4. Son duraktan çıkış yok: REJECTED -> APPROVED olmuyor
  update business_application
     set status = 'REJECTED', decided_at = now(), decision_note = 'deneme reddi'
   where id = v_id;
  begin
    update business_application set status = 'APPROVED' where id = v_id;
  exception when others then v_terminal_red := true;
  end;

  raise notice 'PENDING disi acilis red: % · gerekcesiz ret red: % · terminal cikis red: %',
    v_pending_disi_red, v_gerekcesiz_red, v_terminal_red;

  if not (v_pending_disi_red and v_gerekcesiz_red and v_terminal_red) then
    raise exception 'DOGRULAMA BASARISIZ. Uc kural da true olmaliydi.';
  end if;

  -- ⚠️ Doğrulama kaydı SİLİNMİYOR ve silinemez: olay defteri değişmez
  -- olduğu için `on delete cascade` tetikleyiciye çarpar. Bu bir kusur
  -- değil, sonuç: bir başvurunun izi kalıcıdır. Kayıt REJECTED durumda
  -- kalıyor, adı '0032 Dogrulama Gida A.S.' — açık e-posta tekilliğini de
  -- meşgul etmiyor (reddedilmiş başvuru tekrar başvuruyu engellemez).
end $$;

select 'tablo' as ne, count(*)::text as adet from pg_tables
  where schemaname = 'public'
    and tablename in ('business_application','business_application_event')
union all
select 'politika', count(*)::text from pg_policies
  where tablename in ('business_application','business_application_event')
union all
select 'anon okuma yetkisi (0 olmali)', count(*)::text
  from information_schema.role_table_grants
  where table_name like 'business_application%'
    and privilege_type = 'SELECT' and grantee = 'anon'
union all
select 'dogrulama', 'gecti — PENDING disi acilis, gerekcesiz ret ve terminal cikis reddedildi';
