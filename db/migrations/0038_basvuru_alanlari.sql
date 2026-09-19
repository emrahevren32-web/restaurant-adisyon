-- ═══════════════════════════════════════════════════════════════════════════
-- 0038 — Başvuru formu neyi sorar, neyi sormaz
--
-- ── KARAR ─────────────────────────────────────────────────────────────────
-- Form "kim, nerede, ne büyüklükte" sorar. "Kimliğin ne, nasıl ödeyeceksin"
-- SORMAZ — o sözleşme anının konusudur.
--
--   · Vergi dairesi / vergi–TC numarası  → ZORUNLU DEĞİL
--     Başvuran henüz fiyat konuşmadı, ürünü görmedi. İlk ekranda vergi
--     levhası bilgisi istemek "beni şimdiden kaydediyorlar" hissi verir ve
--     formu yarıda bıraktırır. Bilgi zaten onaydan sonra, fatura kesilirken
--     kesin olarak alınacak. Ekranda "vergi bilgisi eksik" diye görünür.
--
--   · Şube sayısı → ZORUNLU (yeni)
--     Fiyat için değil: onay anında sistem TEK bir merkez şube açıyor.
--     Dört şubeli bir işletmeyi onaydan sonra öğrenmek, kurulumu baştan
--     yapmak demek.
--
--   · Yaklaşık personel sayısı → ZORUNLU (yeni)
--     Kaç kullanıcı hesabı açılacağını ve eğitim yükünü bu belirler.
--
-- ⚠️ Yeni iki kolon NULL KABUL EDİYOR ve varsayılanı YOK. Sebebi: bugün
-- tabloda iki gerçek başvuru var ve onlara bu soru hiç sorulmadı.
-- `default 1` yazsaydım, sorulmamış bir soruya benim uydurduğum cevap
-- veritabanına gerçek gibi girerdi. Eski kayıtlarda ekran "—" gösterir;
-- yeni başvurularda form zorunlu tutar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Vergi bilgisi artık zorunlu değil ────────────────────────────────
alter table business_application alter column tax_number drop not null;
alter table business_application alter column tax_office drop not null;

-- Eski kolon kısıtları NULL'a izin vermiyordu; null'a toleranslı hâlleriyle
-- değiştiriliyor. Dolu yazıldığında biçim kuralı aynen geçerli.
alter table business_application drop constraint if exists business_application_tax_number_check;
alter table business_application drop constraint if exists business_application_tax_office_check;

alter table business_application add constraint business_application_tax_number_check
  check (tax_number is null or length(btrim(tax_number)) between 10 and 11);
alter table business_application add constraint business_application_tax_office_check
  check (tax_office is null or length(btrim(tax_office)) between 2 and 120);

-- ── 2 · İşletmenin büyüklüğü ─────────────────────────────────────────────
alter table business_application add column if not exists branch_count int;
alter table business_application add column if not exists staff_count  int;

alter table business_application drop constraint if exists business_application_branch_count_check;
alter table business_application add constraint business_application_branch_count_check
  check (branch_count is null or branch_count between 1 and 500);

alter table business_application drop constraint if exists business_application_staff_count_check;
alter table business_application add constraint business_application_staff_count_check
  check (staff_count is null or staff_count between 1 and 20000);

comment on column business_application.branch_count is
  'Başvuranın bildirdiği şube sayısı. Onayda YALNIZ merkez şube açılır; '
  'bu sayı, kalanların elle kurulması gerektiğini söyler. Eski kayıtlarda null.';
comment on column business_application.staff_count is
  'Başvuranın bildirdiği yaklaşık personel sayısı. Kullanıcı hesabı ve '
  'eğitim yükünün ölçüsü. Eski kayıtlarda null.';

-- ── 3 · Giriş kapısı yeni imzayla ────────────────────────────────────────
-- ⚠️ İmza DEĞİŞTİĞİ için eski fonksiyonlar DÜŞÜRÜLÜYOR. `create or replace`
-- parametre listesini değiştiremez; yeni bir aşırı yükleme (overload)
-- yaratırdı ve PostgREST iki adaydan hangisini çağıracağını bilemeyip
-- "function is not unique" derdi. Sessiz bir tuzak; açıkça drop ediyoruz.
drop function if exists public.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text);
drop function if exists app.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text);

create or replace function app.basvuru_gonder(
  p_company_name text,
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
  v_ref    text;
  i        int;
begin
  -- Büyüklük soruları zorunlu. Ham kısıt hatası yerine insan cümlesi.
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

  -- Vergi bilgisi boş bırakılabilir; YAZILDIYSA biçimi tutmalı.
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
        (reference, sector_code, company_name, owner_name, phone, email,
         tax_number, tax_office, city, district, address,
         branch_count, staff_count, note)
      values
        (app.basvuru_referansi(), coalesce(nullif(btrim(p_sector_code), ''), 'industrial-kitchen'),
         btrim(p_company_name), btrim(p_owner_name), btrim(p_phone), v_eposta,
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
  'Başvurunun TEK giriş kapısı. Doğrudan insert yetkisi yok. status, '
  'tenant_id ve karar alanları PARAMETRE OLARAK BİLE yok. 0038: vergi '
  'bilgisi isteğe bağlı, şube ve personel sayısı zorunlu.';

-- PostgREST yalnız `public` şemasını yayınlar (0034'ün dersi).
create or replace function public.basvuru_gonder(
  p_company_name text,
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
    p_company_name, p_owner_name, p_phone, p_email,
    p_city, p_district, p_address, p_branch_count, p_staff_count,
    p_tax_number, p_tax_office, p_sector_code, p_note);
$$;

comment on function public.basvuru_gonder is
  'Açık başvuru formunun çağırdığı kapı. app.basvuru_gonder''a geçer.';

revoke all on function public.basvuru_gonder(
  text, text, text, text, text, text, text, int, int, text, text, text, text) from public;
grant execute on function public.basvuru_gonder(
  text, text, text, text, text, text, text, int, int, text, text, text, text)
  to anon, authenticated;

revoke all on function app.basvuru_gonder(
  text, text, text, text, text, text, text, int, int, text, text, text, text) from public;

-- PostgREST'in şema önbelleği yenilensin; yoksa "function not found" der.
notify pgrst, 'reload schema';

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
declare
  v_ref  text;
  v_vergisiz_gecti boolean := false;
  v_subesiz_red    boolean := false;
  v_satir record;
begin
  -- 1) Vergi bilgisi OLMADAN başvuru geçmeli.
  v_ref := public.basvuru_gonder(
    '0038 Dogrulama Gida', 'Deneme Yetkili', '05321234800',
    'dogrulama-0038@example.com', 'İzmir', 'Bornova', 'Deneme adresi 38',
    3, 25);
  v_vergisiz_gecti := v_ref is not null;

  select tax_number, tax_office, branch_count, staff_count into v_satir
    from business_application where reference = v_ref;
  if v_satir.tax_number is not null or v_satir.tax_office is not null then
    raise exception 'Vergi alanlari bos gonderildi ama bos kaydedilmedi.';
  end if;
  if v_satir.branch_count <> 3 or v_satir.staff_count <> 25 then
    raise exception 'Sube/personel sayisi tasinmadi (% / %).',
      v_satir.branch_count, v_satir.staff_count;
  end if;

  -- 2) Şube sayısı olmadan başvuru REDDEDİLMELİ.
  begin
    perform public.basvuru_gonder(
      '0038 Subesiz', 'Deneme Yetkili', '05321234801',
      'dogrulama-0038-b@example.com', 'İzmir', 'Bornova', 'Deneme adresi 38b',
      null, 10);
  exception when others then v_subesiz_red := true;
  end;

  if not (v_vergisiz_gecti and v_subesiz_red) then
    raise exception 'DOGRULAMA BASARISIZ. vergisiz_gecti=% subesiz_red=%',
      v_vergisiz_gecti, v_subesiz_red;
  end if;
  raise notice 'Vergisiz basvuru gecti, subesiz basvuru reddedildi.';
end $$;

-- ⚠️ 0037'nin dersi: doğrulama bloğu kendi çöpünü toplar.
select app.dogrulama_kayitlarini_sil() as dogrulama_kaydi_silindi;

-- Kapı tek mi? İki satır dönerse PostgREST hangisini çağıracağını bilemez.
select p.pronargs as parametre_adedi, pg_get_function_identity_arguments(p.oid) as imza
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'basvuru_gonder';

-- Ekranda kalanlar
select reference as numara, company_name as firma, status as durum,
       coalesce(tax_number, '—') as vergi_no,
       coalesce(branch_count::text, '—') as sube,
       coalesce(staff_count::text, '—')  as personel
from business_application
order by created_at;
