-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0083 · PLATFORM SAHİBİ MÜŞTERİSİNİ GÖREBİLİYOR
--
-- Emrah'ın sorusu (16.10.2026): "Her şirketin kendi detay bilgi sayfası
-- olsun" — 20 maddelik liste. Panel o soruların hiçbirini cevaplamıyordu,
-- çünkü ekranlar localStorage okuyordu (bkz. platform.registry.ts başlığı).
--
-- Ama ekranı veritabanına çevirmek tek başına yetmez: RLS her kiracının
-- verisini kendi içine kilitliyor. Platform yöneticisi başka bir kiracının
-- `app_user` ya da `audit_log` satırını GÖREMEZ. 0035 `tenant`, `company`
-- ve `branch` için platform kapısını açmıştı; diğerleri kapalı.
--
-- ── NEDEN POLİTİKA DEĞİL FONKSİYON ───────────────────────────────────────
-- `app_user`a toptan bir `platform.manage` SELECT politikası eklemek,
-- platform hesabına BÜTÜN kiracıların bütün kullanıcı satırlarını açardı.
-- Oysa gereken şey sayı ve tarih: "kaç kullanıcı", "son giriş ne zaman".
-- Bu yüzden kapı dar: adı konmuş `security definer` fonksiyonlar, her biri
-- `app.platform_kapisi()` ile başlıyor. Desen yeni değil — `basvuruyu_onayla`
-- ve `kiraci_lisansi_ac` aynı şekilde çalışıyor (0035, 0043).
--
-- ⚠️ TUZAK 67 · PostgreSQL'de fonksiyon varsayılanı `PUBLIC EXECUTE` ve
-- `anon`un `app` şeması üzerinde `usage` hakkı var. Her fonksiyonun kapısı
-- ELLE kapatılıyor; dışarı açılan tek yüzey `public` sarmalayıcılar.
--
-- ⚠️ TUZAK 80 · `aclexplode(proacl)` `proacl` NULL iken HİÇBİR ŞEY döndürmez
-- — ve NULL tam olarak "varsayılan, yani açık" demektir. Doğrulama bölümü
-- `acldefault` ile yazıldı.
--
-- Bu göç HİÇBİR TABLOYU DEĞİŞTİRMEZ, hiçbir politikayı gevşetmez.
-- Yalnız okuma fonksiyonu ekler.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · ORTAK KAPI ────────────────────────────────────────────────────────
create or replace function app.platform_kapisi()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Bu veri yalnızca EVREN360 platform yöneticisine açıktır.'
      using errcode = 'MI403';
  end if;
end;
$$;

comment on function app.platform_kapisi() is
  'Platform okuma fonksiyonlarının ortak kapısı. İzin yoksa MI403 atar.';


-- ── 1 · MÜŞTERİ LİSTESİ ───────────────────────────────────────────────────
-- Panelin "Müşteri Listesi" ekranı bunu okuyacak.
-- ⚠️ `is_platform` kiracı (EVREN360'ın kendi kaydı) listeye GİRMEZ:
-- müşteri değil, biziz.
create or replace function app.platform_musteri_listesi()
returns table (
  kiraci_id        uuid,
  kiraci_kodu      text,
  kiraci_adi       text,
  kiraci_durumu    text,
  kayit_tarihi     timestamptz,
  firma_adi        text,
  il               text,
  ilce             text,
  sektor           text,
  paket_adi        text,
  lisans_durumu    text,
  lisans_bitis     date,
  kalan_gun        integer,
  kullanici_sayisi integer,
  son_giris        timestamptz,
  son_hareket      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- ⚠️ Kapı WHERE içinde DEĞİL, gövdenin ilk satırında. WHERE'e koysaydık
  -- hiç satır olmayan bir kiracıda fonksiyon hiç çalışmaz, izinsiz çağrı
  -- da hata almadan boş liste alırdı.
  perform app.platform_kapisi();

  return query
  select
    t.id,
    t.code,
    t.name,
    t.status,
    t.created_at,
    f.company_name,
    f.city,
    f.district,
    coalesce(f.primary_sector_id, b.sector_code),
    p.name,
    l.status,
    l.end_date,
    case when l.end_date is null then null
         else (l.end_date - current_date)::integer end,
    coalesce(k.adet, 0)::integer,
    k.son_giris,
    d.son_hareket
  from public.tenant t

  -- Kiracının ilk firması. Birden çok firma olabilir; kart ana firmayı gösterir.
  left join lateral (
    select c.* from public.company c
     where c.tenant_id = t.id and c.deleted_at is null
     order by c.created_at
     limit 1
  ) f on true

  -- Onaylanmış başvuru: sektör, çalışan ve şube beyanı oradan geliyor.
  left join lateral (
    select ba.* from public.business_application ba
     where ba.tenant_id = t.id and ba.status = 'APPROVED'
     order by ba.decided_at desc nulls last
     limit 1
  ) b on true

  -- Yürürlükteki lisans. Yoksa en son biten gösteriliyor ki "lisansı bitti"
  -- ile "hiç lisans verilmedi" birbirine karışmasın.
  left join lateral (
    select tl.* from public.tenant_license tl
     where tl.tenant_id = t.id
     order by (tl.status in ('Deneme','Aktif')) desc, tl.end_date desc
     limit 1
  ) l on true
  left join public.license_package p on p.id = l.package_id

  left join lateral (
    select count(*) as adet, max(u.last_sign_in_at) as son_giris
      from public.app_user a
      left join auth.users u on u.id = a.auth_user_id
     where a.tenant_id = t.id
  ) k on true

  left join lateral (
    select max(al.occurred_at) as son_hareket
      from public.audit_log al
     where al.tenant_id = t.id
  ) d on true

  where not t.is_platform
  order by t.created_at desc;
end;
$$;

comment on function app.platform_musteri_listesi() is
  'EVREN360 müşteri listesi. Platform kiracısı hariç bütün kiracılar, '
  'firma/lisans/kullanım özetiyle. Yalnız platform.manage.';


-- ── 2 · MÜŞTERİ DETAYI ────────────────────────────────────────────────────
-- Emrah'ın 20 maddelik listesinin bugün cevaplanabilen kısmı.
-- Cevaplanamayanlar BİLEREK yok: 2.4 taahhüt, 5.2 sonraki ödeme,
-- 5.3 borç, 5.4 yönetici notu. Onların deposu 0084'te açılacak.
-- Uydurma sütun döndürmek, boş sütun döndürmekten kötüdür.
create or replace function app.platform_musteri_detayi(p_kiraci uuid)
returns table (
  -- 1 · Şirket bilgileri
  kiraci_id             uuid,
  kiraci_kodu           text,
  kiraci_adi            text,
  kiraci_durumu         text,
  firma_adi             text,   -- 1.1
  ticari_unvan          text,   -- 1.1
  sektor                text,   -- 1.2
  il                    text,   -- 1.3
  ilce                  text,   -- 1.3
  adres                 text,   -- 1.3
  telefon               text,   -- 1.4
  eposta                text,   -- 1.4
  web_sitesi            text,   -- 1.4
  vergi_dairesi         text,
  vergi_no              text,
  beyan_calisan_sayisi  integer, -- 1.5 (başvuruda beyan edilen)
  beyan_sube_sayisi     integer, -- 1.5 (başvuruda beyan edilen)
  kayitli_sube_sayisi   integer, -- 1.5 (sistemde gerçekten açılmış)

  -- 2 · Üyelik ve lisans
  kayit_tarihi          timestamptz, -- 2.1
  uyelik_durumu         text,        -- 2.2
  lisans_durumu         text,        -- 2.2
  lisans_baslangic      date,        -- 2.3
  lisans_bitis          date,        -- 2.3
  kalan_gun             integer,     -- 2.3
  deneme_mi             boolean,     -- 2.2
  paket_kodu            text,        -- 2.5
  paket_adi             text,        -- 2.5
  moduller              text[],      -- 2.5
  lisans_notu           text,

  -- 3 · Yetkili ve kullanıcı
  yetkili_ad            text,    -- 3.1
  yetkili_unvan         text,    -- 3.1
  yetkili_telefon       text,    -- 3.1
  yetkili_eposta        text,    -- 3.1
  kullanici_sayisi      integer, -- 3.2
  aktif_kullanici       integer, -- 3.2
  son_giris             timestamptz, -- 3.3

  -- 4 · Kullanım
  son_hareket           timestamptz, -- 4.1
  son_30_gun_islem      integer,     -- 4.1

  -- 5 · Ödeme (bugün yalnız paket fiyatı var)
  aylik_ucret           numeric,     -- 5.1
  yillik_ucret          numeric,     -- 5.1
  fiyat_belirlendi      boolean      -- 5.1 · 0 ile "bedava"yı ayırmak için
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.platform_kapisi();

  return query
  select
    t.id, t.code, t.name, t.status,
    f.company_name,
    nullif(btrim(coalesce(f.legal_name, '')), ''),
    coalesce(f.primary_sector_id, b.sector_code),
    coalesce(f.city, b.city),
    coalesce(f.district, b.district),
    coalesce(f.address, b.address),
    coalesce(f.phone, b.phone),
    coalesce(f.email, b.email),
    nullif(btrim(coalesce(f.website, '')), ''),
    coalesce(f.tax_office, b.tax_office),
    coalesce(f.tax_number, b.tax_number),
    b.staff_count,
    b.branch_count,
    coalesce(s.adet, 0)::integer,

    t.created_at,
    t.status,
    l.status,
    l.start_date,
    l.end_date,
    case when l.end_date is null then null
         else (l.end_date - current_date)::integer end,
    l.is_trial,
    p.code,
    p.name,
    m.moduller,
    l.note,

    coalesce(f.authorized_person, b.owner_name),
    f.authorized_title,
    coalesce(f.authorized_phone, b.phone),
    coalesce(f.authorized_email, b.email),
    coalesce(k.adet, 0)::integer,
    coalesce(k.aktif, 0)::integer,
    k.son_giris,

    d.son_hareket,
    coalesce(d.son_30_gun, 0)::integer,

    p.monthly_price,
    p.yearly_price,
    coalesce(p.monthly_price, 0) > 0 or coalesce(p.yearly_price, 0) > 0

  from public.tenant t

  left join lateral (
    select c.* from public.company c
     where c.tenant_id = t.id and c.deleted_at is null
     order by c.created_at limit 1
  ) f on true

  left join lateral (
    select ba.* from public.business_application ba
     where ba.tenant_id = t.id and ba.status = 'APPROVED'
     order by ba.decided_at desc nulls last limit 1
  ) b on true

  left join lateral (
    select tl.* from public.tenant_license tl
     where tl.tenant_id = t.id
     order by (tl.status in ('Deneme','Aktif')) desc, tl.end_date desc limit 1
  ) l on true
  left join public.license_package p on p.id = l.package_id

  left join lateral (
    select array_agg(lpm.module_key order by lpm.module_key) as moduller
      from public.license_package_module lpm
     where lpm.package_id = p.id
  ) m on true

  left join lateral (
    select count(*) as adet from public.branch br where br.tenant_id = t.id
  ) s on true

  left join lateral (
    select
      count(*)                                   as adet,
      count(*) filter (where a.is_active)        as aktif,
      max(u.last_sign_in_at)                     as son_giris
      from public.app_user a
      left join auth.users u on u.id = a.auth_user_id
     where a.tenant_id = t.id
  ) k on true

  left join lateral (
    select
      max(al.occurred_at) as son_hareket,
      count(*) filter (where al.occurred_at >= now() - interval '30 days') as son_30_gun
      from public.audit_log al
     where al.tenant_id = t.id
  ) d on true

  where t.id = p_kiraci
    and not t.is_platform;
end;
$$;

comment on function app.platform_musteri_detayi(uuid) is
  'Bir müşterinin kartı. Taahhüt, ödeme tarihi, borç ve yönetici notu '
  'BİLEREK yok — onların tablosu henüz kurulmadı (0084).';


-- ── 3 · MÜŞTERİNİN KULLANICILARI ──────────────────────────────────────────
-- Soru 3.2 ve 3.3'ün ayrıntısı. Şifre, auth kimliği ve e-posta adresi
-- DÖNMÜYOR: platform sahibinin "kim, hangi rol, en son ne zaman girdi"
-- bilmesi yeterli.
create or replace function app.platform_musteri_kullanicilari(p_kiraci uuid)
returns table (
  kullanici_id uuid,
  ad_soyad     text,
  kullanici_adi text,
  rol_kodu     text,
  aktif        boolean,
  olusturma    timestamptz,
  son_giris    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.platform_kapisi();

  return query
  select
    a.id, a.full_name, a.username, a.role_code, a.is_active,
    a.created_at, u.last_sign_in_at
  from public.app_user a
  left join auth.users u on u.id = a.auth_user_id
  join public.tenant t on t.id = a.tenant_id
  where a.tenant_id = p_kiraci
    and not t.is_platform
  order by a.is_active desc, u.last_sign_in_at desc nulls last, a.full_name;
end;
$$;


-- ── 4 · HANGİ SAATLERDE KULLANIYOR (soru 4.2) ─────────────────────────────
-- ⚠️ Saat TÜRKİYE saatiyle. `occurred_at` UTC tutuluyor; ham saati
-- göstermek "sabah 6'da çalışıyorlar" gibi yanlış bir tablo çıkarırdı.
create or replace function app.platform_kullanim_saatleri(
  p_kiraci uuid,
  p_gun    integer default 90
)
returns table (saat integer, islem_sayisi bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.platform_kapisi();

  return query
  select
    extract(hour from al.occurred_at at time zone 'Europe/Istanbul')::integer,
    count(*)
  from public.audit_log al
  join public.tenant t on t.id = al.tenant_id
  where al.tenant_id = p_kiraci
    and not t.is_platform
    and al.occurred_at >= now() - make_interval(days => greatest(coalesce(p_gun, 90), 1))
  group by 1
  order by 1;
end;
$$;


-- ── 5 · EN ÇOK ÜRETTİĞİ VE SEVK ETTİĞİ ÜRÜNLER (soru 1.6) ─────────────────
-- ⚠️ Bu, müşterinin TİCARİ verisidir. Fonksiyon yalnız ürün adı ve toplam
-- miktar döndürüyor; müşteri adı, fiyat ve kâr DÖNMÜYOR.
-- Üretim: tamamlanmış iş emirlerinin çıktı kalemi.
-- Sevkiyat: sevk satırları.
create or replace function app.platform_populer_urunler(
  p_kiraci uuid,
  p_gun    integer default 180,
  p_adet   integer default 5
)
returns table (tur text, urun text, toplam numeric, birim text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.platform_kapisi();

  return query
  with gecerli as (
    select t.id from public.tenant t
     where t.id = p_kiraci and not t.is_platform
  ),
  pencere as (
    select now() - make_interval(days => greatest(coalesce(p_gun, 180), 1)) as bas
  ),
  uretim as (
    select 'uretim'::text as tur, si.name as urun,
           sum(w.planned_qty) as toplam, w.output_uom as birim
      from public.work_order w
      join public.stock_item si on si.id = w.output_item_id
      join gecerli g on g.id = w.tenant_id
     where w.status = 'COMPLETED'
       and coalesce(w.completed_at, w.created_at) >= (select bas from pencere)
     group by si.name, w.output_uom
     order by sum(w.planned_qty) desc
     limit greatest(coalesce(p_adet, 5), 1)
  ),
  sevk as (
    select 'sevkiyat'::text as tur, si.name as urun,
           sum(sl.qty) as toplam, sl.uom as birim
      from public.shipment_line sl
      join public.shipment sh on sh.id = sl.shipment_id
      join public.stock_item si on si.id = sl.stock_item_id
      join gecerli g on g.id = sl.tenant_id
     where sh.created_at >= (select bas from pencere)
     group by si.name, sl.uom
     order by sum(sl.qty) desc
     limit greatest(coalesce(p_adet, 5), 1)
  )
  select u.tur, u.urun, u.toplam, u.birim from uretim u
  union all
  select s.tur, s.urun, s.toplam, s.birim from sevk s;
end;
$$;

comment on function app.platform_populer_urunler(uuid, integer, integer) is
  'Müşterinin en çok ürettiği ve sevk ettiği ürünler. Ad ve miktar; '
  'fiyat ve müşteri adı DÖNMEZ.';


-- ── 6 · PostgREST KAPILARI ────────────────────────────────────────────────
create or replace function public.platform_musteri_listesi()
returns table (
  kiraci_id uuid, kiraci_kodu text, kiraci_adi text, kiraci_durumu text,
  kayit_tarihi timestamptz, firma_adi text, il text, ilce text, sektor text,
  paket_adi text, lisans_durumu text, lisans_bitis date, kalan_gun integer,
  kullanici_sayisi integer, son_giris timestamptz, son_hareket timestamptz
)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.platform_musteri_listesi() $$;

-- ⚠️ `setof record` OLMAZ: PostgREST sütunları bilmeden çağıramaz.
-- Sütun listesi app fonksiyonuyla BİREBİR aynı olmak zorunda; doğrulama
-- bölümü bunu sayıyor.
create or replace function public.platform_musteri_detayi(p_kiraci uuid)
returns table (
  kiraci_id uuid, kiraci_kodu text, kiraci_adi text, kiraci_durumu text,
  firma_adi text, ticari_unvan text, sektor text, il text, ilce text,
  adres text, telefon text, eposta text, web_sitesi text,
  vergi_dairesi text, vergi_no text,
  beyan_calisan_sayisi integer, beyan_sube_sayisi integer,
  kayitli_sube_sayisi integer,
  kayit_tarihi timestamptz, uyelik_durumu text, lisans_durumu text,
  lisans_baslangic date, lisans_bitis date, kalan_gun integer,
  deneme_mi boolean, paket_kodu text, paket_adi text, moduller text[],
  lisans_notu text,
  yetkili_ad text, yetkili_unvan text, yetkili_telefon text,
  yetkili_eposta text, kullanici_sayisi integer, aktif_kullanici integer,
  son_giris timestamptz,
  son_hareket timestamptz, son_30_gun_islem integer,
  aylik_ucret numeric, yillik_ucret numeric, fiyat_belirlendi boolean
)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.platform_musteri_detayi(p_kiraci) $$;

create or replace function public.platform_musteri_kullanicilari(p_kiraci uuid)
returns table (
  kullanici_id uuid, ad_soyad text, kullanici_adi text, rol_kodu text,
  aktif boolean, olusturma timestamptz, son_giris timestamptz
)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.platform_musteri_kullanicilari(p_kiraci) $$;

create or replace function public.platform_kullanim_saatleri(
  p_kiraci uuid, p_gun integer default 90
)
returns table (saat integer, islem_sayisi bigint)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.platform_kullanim_saatleri(p_kiraci, p_gun) $$;

create or replace function public.platform_populer_urunler(
  p_kiraci uuid, p_gun integer default 180, p_adet integer default 5
)
returns table (tur text, urun text, toplam numeric, birim text)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.platform_populer_urunler(p_kiraci, p_gun, p_adet) $$;


-- ── 7 · KAPILAR ELLE KAPATILIYOR (tuzak 67) ───────────────────────────────
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'app.platform_kapisi()',
    'app.platform_musteri_listesi()',
    'app.platform_musteri_detayi(uuid)',
    'app.platform_musteri_kullanicilari(uuid)',
    'app.platform_kullanim_saatleri(uuid, integer)',
    'app.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to service_role', v_ad);
  end loop;

  foreach v_ad in array array[
    'public.platform_musteri_listesi()',
    'public.platform_musteri_detayi(uuid)',
    'public.platform_musteri_kullanicilari(uuid)',
    'public.platform_kullanim_saatleri(uuid, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end;
$$;


-- ── 8 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_ad  text;
  v_acl aclitem[];
begin
  foreach v_ad in array array[
    'app.platform_kapisi()',
    'app.platform_musteri_listesi()',
    'app.platform_musteri_detayi(uuid)',
    'app.platform_musteri_kullanicilari(uuid)',
    'app.platform_kullanim_saatleri(uuid, integer)',
    'app.platform_populer_urunler(uuid, integer, integer)',
    'public.platform_musteri_listesi()',
    'public.platform_musteri_detayi(uuid)',
    'public.platform_musteri_kullanicilari(uuid)',
    'public.platform_kullanim_saatleri(uuid, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    if to_regprocedure(v_ad) is null then
      raise exception '0083: % oluşmadı.', v_ad;
    end if;

    -- ⚠️ TUZAK 80: `proacl` NULL ise aclexplode BOŞ döner ve "PUBLIC yok"
    -- sanılır. Oysa NULL = VARSAYILAN = PUBLIC EXECUTE AÇIK.
    select coalesce(p.proacl, acldefault('f', p.proowner))
      into v_acl
      from pg_proc p
     where p.oid = to_regprocedure(v_ad);

    if exists (
      select 1 from aclexplode(v_acl) a
       where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0083: % üzerinde PUBLIC EXECUTE hâlâ açık.', v_ad;
    end if;
  end loop;

  -- `anon` hiçbirini çağıramamalı.
  foreach v_ad in array array[
    'public.platform_musteri_listesi()',
    'public.platform_musteri_detayi(uuid)',
    'public.platform_musteri_kullanicilari(uuid)',
    'public.platform_kullanim_saatleri(uuid, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    if has_function_privilege('anon', to_regprocedure(v_ad), 'execute') then
      raise exception '0083: anon % çağırabiliyor.', v_ad;
    end if;
  end loop;

  raise notice '0083 tamam: platform okuma kapıları açıldı, dış kapılar kapalı.';
end;
$$;
