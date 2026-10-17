-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0084 · TİCARİ UNVAN SORULUYOR · ÇAĞRILMAYAN KAPI KAPANIYOR
--
-- ── 1 · TİCARİ UNVAN (Emrah, 16.10.2026) ─────────────────────────────────
-- Müşteri kartında "1.1 Tam ticari unvan" boş görünüyordu. Sebebini
-- araştırınca iki şey çıktı:
--
--   a) Başvuru formu ticari unvanı HİÇ sormuyor.
--   b) Onay (0035) `company.legal_name` alanına `company_name`i KOPYALIYOR.
--      Yani alan boş değil — ama içinde gerçek ticari unvan da yok. Bu
--      daha kötüsü: dolu görünen ama yanlış olan bir alan.
--
-- Emrah'ın kuralı: "Olmayan bir verinin boş alanı ne işimize yarar ki?
-- Ya doldurtalım ya hiç sormayalım." Ticari unvan faturada yazan addır;
-- fatura kesilecekse lazım. O yüzden SORULUYOR.
--
-- ⚠️ Kolon NULL KABUL EDİYOR. Sebebi 0038'deki ile aynı: bugün tabloda
-- bu soru sorulmamış başvurular var. `default` yazmak, sorulmamış bir
-- soruya benim uydurduğum cevabı gerçek gibi kaydetmek olurdu. Eski
-- kayıtlarda ekran "—" gösterir; YENİ başvurularda kapı zorunlu tutar.
--
-- ── 2 · ÇAĞRILMAYAN OKUMA KAPISI KAPANIYOR ───────────────────────────────
-- 0083 ile `app.platform_populer_urunler` yazılmıştı: müşterinin en çok
-- ürettiği ve sevk ettiği ürünler. Emrah kararı (16.10.2026): ekrana
-- KONMADI — "en çok neyi üretiyor" müşterinin ticari bilgisidir ve
-- MİYOP'un ona bakması müşteride haklı bir rahatsızlık yaratır.
--
-- Fonksiyon duruyor ve kimse çağırmıyor. Çağrılmayan bir okuma kapısı
-- açık kapıdır: yarın bir ekran onu "madem var" diye kullanır, ya da bir
-- izin hatası onu dışarı açar. Düşürülüyor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Kolon ─────────────────────────────────────────────────────────────
alter table business_application add column if not exists legal_name text;

alter table business_application drop constraint if exists business_application_legal_name_check;
alter table business_application add constraint business_application_legal_name_check
  check (legal_name is null or length(btrim(legal_name)) between 2 and 200);

comment on column business_application.legal_name is
  'Faturada yazan resmî ticari unvan ("… Gıda Sanayi ve Ticaret A.Ş."). '
  'Onayda company.legal_name''e taşınır. Eski kayıtlarda null.';


-- ── 2 · Giriş kapısı yeni imzayla ─────────────────────────────────────────
-- ⚠️ TUZAK (0038''in dersi): `create or replace` parametre listesini
-- değiştiremez; yeni bir aşırı yükleme yaratır ve PostgREST "function is
-- not unique" der. Eski imza ÖNCE düşürülüyor.
drop function if exists public.basvuru_gonder(
  text, text, text, text, text, text, text, int, int, text, text, text, text);
drop function if exists app.basvuru_gonder(
  text, text, text, text, text, text, text, int, int, text, text, text, text);

create or replace function app.basvuru_gonder(
  p_company_name text,
  p_legal_name   text,
  p_owner_name   text,
  p_phone        text,
  p_email        text,
  p_city         text,
  p_district     text,
  p_address      text,
  p_branch_count int,
  p_staff_count  int,
  p_tax_number   text default null,
  p_tax_office   text default null,
  p_sector_code  text default 'industrial-kitchen',
  p_note         text default null
)
returns text
language plpgsql security definer set search_path = public, app as $$
declare
  v_eposta text := lower(btrim(p_email));
  v_vno    text := nullif(btrim(coalesce(p_tax_number, '')), '');
  v_vd     text := nullif(btrim(coalesce(p_tax_office, '')), '');
  v_unvan  text := nullif(btrim(coalesce(p_legal_name, '')), '');
  v_ref    text;
  i        int;
begin
  -- Ticari unvan ZORUNLU. Firma adıyla aynıysa aynısı yazılır — formda
  -- öyle yazıyor. Boş geçilebilseydi alan yine boş kalırdı ve bu göçün
  -- hiçbir anlamı olmazdı.
  if v_unvan is null then
    raise exception 'Ticari unvanı yazın. Firma adıyla aynıysa aynısını yazabilirsiniz.'
      using errcode = 'MI400';
  end if;
  if length(v_unvan) < 2 or length(v_unvan) > 200 then
    raise exception 'Ticari unvan 2 ile 200 karakter arasında olmalı.'
      using errcode = 'MI400';
  end if;

  -- Büyüklük soruları zorunlu (0038).
  if p_branch_count is null then
    raise exception 'Şube sayısını yazın. En az 1 olmalı.' using errcode = 'MI400';
  end if;
  if p_staff_count is null then
    raise exception 'Yaklaşık personel sayısını yazın. En az 1 olmalı.' using errcode = 'MI400';
  end if;
  if p_branch_count < 1 or p_branch_count > 500 then
    raise exception 'Şube sayısı 1 ile 500 arasında olmalı.' using errcode = 'MI400';
  end if;
  if p_staff_count < 1 or p_staff_count > 20000 then
    raise exception 'Personel sayısı 1 ile 20000 arasında olmalı.' using errcode = 'MI400';
  end if;

  -- Vergi bilgisi boş bırakılabilir; YAZILDIYSA biçimi tutmalı (0038).
  if v_vno is not null and length(v_vno) not between 10 and 11 then
    raise exception 'Vergi/TC numarası 10 ya da 11 haneli olmalı. Boş da bırakabilirsiniz.'
      using errcode = 'MI400';
  end if;

  if exists (
    select 1 from business_application
     where lower(btrim(email)) = v_eposta
       and status in ('PENDING','IN_REVIEW')
  ) then
    raise exception 'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var.'
      using errcode = 'MI409';
  end if;

  for i in 1..5 loop
    begin
      insert into business_application
        (reference, sector_code, company_name, legal_name, owner_name, phone, email,
         tax_number, tax_office, city, district, address,
         branch_count, staff_count, note)
      values
        (app.basvuru_referansi(), coalesce(nullif(btrim(p_sector_code), ''), 'industrial-kitchen'),
         btrim(p_company_name), v_unvan, btrim(p_owner_name), btrim(p_phone), v_eposta,
         v_vno, v_vd, btrim(p_city), btrim(p_district), btrim(p_address),
         p_branch_count, p_staff_count, nullif(btrim(coalesce(p_note,'')), ''))
      returning reference into v_ref;
      return v_ref;
    exception when unique_violation then
      if exists (
        select 1 from business_application
         where lower(btrim(email)) = v_eposta
           and status in ('PENDING','IN_REVIEW')
      ) then
        raise exception 'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var.'
          using errcode = 'MI409';
      end if;
    end;
  end loop;

  raise exception 'Başvuru numarası üretilemedi. Lütfen tekrar deneyin.'
    using errcode = 'MI500';
end $$;

comment on function app.basvuru_gonder is
  'Başvurunun TEK giriş kapısı. status, tenant_id ve karar alanları '
  'PARAMETRE OLARAK BİLE yok. 0084: ticari unvan zorunlu.';

create or replace function public.basvuru_gonder(
  p_company_name text,
  p_legal_name   text,
  p_owner_name   text,
  p_phone        text,
  p_email        text,
  p_city         text,
  p_district     text,
  p_address      text,
  p_branch_count int,
  p_staff_count  int,
  p_tax_number   text default null,
  p_tax_office   text default null,
  p_sector_code  text default 'industrial-kitchen',
  p_note         text default null
)
returns text
language sql security definer set search_path = public, app as $$
  select app.basvuru_gonder(
    p_company_name, p_legal_name, p_owner_name, p_phone, p_email,
    p_city, p_district, p_address, p_branch_count, p_staff_count,
    p_tax_number, p_tax_office, p_sector_code, p_note);
$$;

comment on function public.basvuru_gonder is
  'Açık başvuru formunun çağırdığı kapı. app.basvuru_gonder''a geçer.';

revoke all on function public.basvuru_gonder(
  text, text, text, text, text, text, text, text, int, int, text, text, text, text) from public;
grant execute on function public.basvuru_gonder(
  text, text, text, text, text, text, text, text, int, int, text, text, text, text)
  to anon, authenticated;

revoke all on function app.basvuru_gonder(
  text, text, text, text, text, text, text, text, int, int, text, text, text, text) from public;
revoke all on function app.basvuru_gonder(
  text, text, text, text, text, text, text, text, int, int, text, text, text, text) from anon;


-- ── 3 · Onay ticari unvanı TAŞISIN ────────────────────────────────────────
-- ⚠️ 0035 `legal_name` alanına `company_name`i KOPYALIYORDU. Artık başvuruda
-- gerçek unvan varsa o yazılıyor; yoksa (eski kayıtlar) eski davranış
-- sürüyor — eski bir başvuruyu onaylarken alanı boş bırakmak, dolu olanı
-- yanlış doldurmaktan iyi değil; ikisi de bilgi vermiyor, ama kopyalama
-- en azından faturada bir ad yazmasını sağlıyor.
create or replace function app.basvuru_firma_unvani(p_basvuru uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    nullif(btrim(coalesce(b.legal_name, '')), ''),
    b.company_name
  )
  from public.business_application b
  where b.id = p_basvuru
$$;

comment on function app.basvuru_firma_unvani(uuid) is
  'Onayda company.legal_name''e yazılacak ad. Başvuruda gerçek unvan varsa '
  'o, yoksa firma adı (eski kayıtlar).';

revoke all on function app.basvuru_firma_unvani(uuid) from public;
revoke all on function app.basvuru_firma_unvani(uuid) from anon;
grant execute on function app.basvuru_firma_unvani(uuid) to service_role;

do $$
declare
  v_kaynak text;
  v_yeni   text;
begin
  -- 0035'teki gövdeyi OLDUĞU GİBİ alıp yalnız tek satırını değiştiriyoruz.
  -- Fonksiyonu baştan yazmak, 0035'teki bütün kuralları (izin kontrolü,
  -- kiracı kodu üretimi, merkez şube) ikinci kez yazmak demekti.
  select pg_get_functiondef(to_regprocedure('app.basvuruyu_onayla(uuid, text)'))
    into v_kaynak;

  if v_kaynak is null then
    raise exception '0084: app.basvuruyu_onayla bulunamadı.';
  end if;

  -- ⚠️ TEKRAR ÇALIŞTIRILABİLİR OLMALI (teslim kontrol listesi, madde 3).
  -- İlk sürüm bunu gözden kaçırdı: ikinci koşuda aranan satır artık
  -- değişmiş olduğu için göç KENDİ BAŞARISINI hata sanıp patlıyordu.
  if position('coalesce(nullif(btrim(coalesce(v_b.legal_name,' in v_kaynak) > 0 then
    raise notice '0084: onay fonksiyonu zaten yamalanmis, atlaniyor.';
    return;
  end if;

  if position('v_kiraci, v_kod, v_b.company_name, v_b.company_name,' in v_kaynak) = 0 then
    raise exception
      '0084: onay fonksiyonunda beklenen satır yok — 0035 değişmiş olabilir. '
      'Elle gözden geçirin.';
  end if;

  v_yeni := replace(
    v_kaynak,
    'v_kiraci, v_kod, v_b.company_name, v_b.company_name,',
    'v_kiraci, v_kod, v_b.company_name, '
      || 'coalesce(nullif(btrim(coalesce(v_b.legal_name, '''''''')), ''''''''), v_b.company_name),'
  );

  execute v_yeni;
end $$;


-- ── 4 · Çağrılmayan ürün kapısı düşüyor ───────────────────────────────────
drop function if exists public.platform_populer_urunler(uuid, integer, integer);
drop function if exists app.platform_populer_urunler(uuid, integer, integer);


-- PostgREST'in şema önbelleği yenilensin; yoksa "function not found" der.
notify pgrst, 'reload schema';


-- ── 5 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_ad   text;
  v_acl  aclitem[];
  v_tanim text;
begin
  -- Kolon
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'business_application'
       and column_name = 'legal_name'
  ) then
    raise exception '0084: business_application.legal_name oluşmadı.';
  end if;

  -- Yeni imza var, eski imza YOK
  if to_regprocedure(
    'public.basvuru_gonder(text, text, text, text, text, text, text, text, '
    || 'int, int, text, text, text, text)') is null then
    raise exception '0084: yeni basvuru_gonder imzası oluşmadı.';
  end if;
  if to_regprocedure(
    'public.basvuru_gonder(text, text, text, text, text, text, text, '
    || 'int, int, text, text, text, text)') is not null then
    raise exception '0084: ESKİ basvuru_gonder imzası duruyor — iki aday kalır.';
  end if;

  -- Ürün kapısı gerçekten düştü mü
  foreach v_ad in array array[
    'app.platform_populer_urunler(uuid, integer, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    if to_regprocedure(v_ad) is not null then
      raise exception '0084: % hâlâ duruyor.', v_ad;
    end if;
  end loop;

  -- Onay fonksiyonu ticari unvanı taşıyor mu
  select pg_get_functiondef(to_regprocedure('app.basvuruyu_onayla(uuid, text)'))
    into v_tanim;
  if position('v_b.legal_name' in v_tanim) = 0 then
    raise exception '0084: onay fonksiyonu legal_name''i taşımıyor.';
  end if;

  -- ⚠️ TUZAK 80: proacl NULL = VARSAYILAN = PUBLIC AÇIK
  foreach v_ad in array array[
    'app.basvuru_gonder(text, text, text, text, text, text, text, text, '
      || 'int, int, text, text, text, text)',
    'app.basvuru_firma_unvani(uuid)'
  ] loop
    select coalesce(p.proacl, acldefault('f', p.proowner)) into v_acl
      from pg_proc p where p.oid = to_regprocedure(v_ad);
    if exists (
      select 1 from aclexplode(v_acl) a
       where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0084: % üzerinde PUBLIC EXECUTE açık.', v_ad;
    end if;
    if has_function_privilege('anon', to_regprocedure(v_ad), 'execute') then
      raise exception '0084: anon % çağırabiliyor.', v_ad;
    end if;
  end loop;

  -- Açık form kapısı `anon`a AÇIK kalmalı (başvuran henüz giriş yapmamış).
  if not has_function_privilege('anon', to_regprocedure(
    'public.basvuru_gonder(text, text, text, text, text, text, text, text, '
    || 'int, int, text, text, text, text)'), 'execute') then
    raise exception '0084: anon başvuru formunu çağıramıyor — form kırılır.';
  end if;

  raise notice '0084 tamam: ticari unvan zorunlu, ürün kapısı kapandı.';
end $$;
