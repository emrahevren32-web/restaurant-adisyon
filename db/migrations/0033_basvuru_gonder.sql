-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4D / KAPI
-- 0033 — Başvuru numarası ve tek giriş kapısı
--
-- ── 0032'DE ÇÖZÜLMEYEN İKİ ŞEY ───────────────────────────────────────────
-- 1. NUMARA YOK. `anon`a okuma vermedik (doğru karar), ama o yüzden form
--    başvuruyu yazdıktan sonra kaydın kimliğini geri okuyamıyor. Ekran da
--    müşteriye bir şey söyleyemiyor. Eski localStorage ekranı
--    `business_application_1789751294946_0dc312d30e61f` gibi bir iç kimlik
--    basıyordu — müşteri onu ne okur ne telefonda söyler.
-- 2. İKİ KAPI. 0032 hem `anon`a hem `authenticated`a doğrudan insert
--    yetkisi verdi. Aynı odaya iki kapı, iki ayrı güvence demektir; biri
--    ileride gevşerse fark edilmez.
--
-- ── ÇÖZÜM: TEK FONKSİYON, KISA NUMARA ───────────────────────────────────
-- `app.basvuru_gonder(...)` — `security definer`. Doğrudan insert yetkisi
-- KALDIRILIYOR; başvuru yalnız bu fonksiyondan girer.
--
-- Bu, kolon bazlı GRANT'tan DAHA güçlü: fonksiyon `status`, `tenant_id`,
-- `decided_*` parametrelerini hiç kabul etmiyor. Yazılamayacak bir alanı
-- göndermeye çalışmak mümkün değil, çünkü öyle bir parametre yok.
--
-- ── NUMARA NEDEN BÖYLE ──────────────────────────────────────────────────
-- `MIY-K7R3Q` · 5 karakter, karışan harfler ÇIKARILMIŞ (0/O, 1/I/L yok).
-- Telefonda okunur, elle yazılır, ekran görüntüsünden doğru aktarılır.
--
-- ⚠️ Numara bir ANAHTAR DEĞİL. Müşteri onunla başvurusunu SORGULAYAMAZ —
-- okuma yetkisi hâlâ yok. Sadece "hangi başvuru" sorusunun cevabı. Numarayı
-- bilmek hiçbir kapı açmaz; bu yüzden kısa olması sorun değil.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Numara üreteci ────────────────────────────────────────────────────────
-- Karışan karakterler yok: 0/O, 1/I/L, 8/B gibi çiftlerden yalnız biri.
create or replace function app.basvuru_referansi()
returns text
language plpgsql volatile as $$
declare
  v_alfabe text := '23456789ACDEFGHJKMNPQRTUVWXYZ';
  v_kod    text := '';
  i        int;
begin
  for i in 1..5 loop
    v_kod := v_kod || substr(v_alfabe, 1 + floor(random() * length(v_alfabe))::int, 1);
  end loop;
  return 'MIY-' || v_kod;
end $$;

comment on function app.basvuru_referansi() is
  'Okunabilir başvuru numarası. Anahtar DEĞİL — sorgulama yetkisi vermez.';

alter table business_application
  add column if not exists reference text;

-- Var olan satırlara numara ver (bu göçten önce girenler).
update business_application set reference = app.basvuru_referansi()
 where reference is null;

-- Numara tekil olmak zorunda: iki başvuru aynı numarayı taşırsa telefonda
-- "hangi başvuru" sorusu cevapsız kalır.
create unique index if not exists business_application_referans_tekil
  on business_application (reference);

alter table business_application
  alter column reference set default app.basvuru_referansi();
alter table business_application
  alter column reference set not null;

-- ── Sektör kodu: uygulamanın kullandığı değer ────────────────────────────
-- 0032'de varsayılanı `endustriyel-mutfak` yazmışım. Uygulamanın sektör
-- kataloğunda (`src/sector/sector.registry.ts`) o kod YOK; gerçek kod
-- `industrial-kitchen`. Yani hiçbir sektöre karşılık gelmeyen bir
-- varsayılan bırakmışım — form kodu açıkça gönderdiği için bugün zarar
-- vermiyor, ama form bir gün göndermezse sessizce bozulurdu.
alter table business_application
  alter column sector_code set default 'industrial-kitchen';

update business_application
   set sector_code = 'industrial-kitchen'
 where sector_code = 'endustriyel-mutfak';

-- ── Tek giriş kapısı ──────────────────────────────────────────────────────
create or replace function app.basvuru_gonder(
  p_company_name text,
  p_owner_name   text,
  p_phone        text,
  p_email        text,
  p_tax_number   text,
  p_tax_office   text,
  p_city         text,
  p_district     text,
  p_address      text,
  p_sector_code  text default 'industrial-kitchen',
  p_note         text default null
)
returns text
language plpgsql security definer set search_path = public, app as $$
declare
  v_eposta text := lower(btrim(p_email));
  v_ref    text;
  i        int;
begin
  -- Açık başvuru varsa, kullanıcıya ANLAŞILIR cümle. Ham veritabanı hatası
  -- ekrana basılmaz.
  if exists (
    select 1 from business_application
     where lower(btrim(email)) = v_eposta
       and status in ('PENDING','IN_REVIEW')
  ) then
    raise exception 'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var.'
      using errcode = 'MI409';
  end if;

  -- Numara çakışması pratikte yok (29^5 ≈ 20 milyon) ama olabilir.
  -- Sessizce hata vermek yerine birkaç kez deniyoruz.
  for i in 1..5 loop
    begin
      insert into business_application
        (reference, sector_code, company_name, owner_name, phone, email,
         tax_number, tax_office, city, district, address, note)
      values
        (app.basvuru_referansi(), coalesce(nullif(btrim(p_sector_code), ''), 'industrial-kitchen'),
         btrim(p_company_name), btrim(p_owner_name), btrim(p_phone), v_eposta,
         btrim(p_tax_number), btrim(p_tax_office), btrim(p_city),
         btrim(p_district), btrim(p_address), nullif(btrim(coalesce(p_note,'')), ''))
      returning reference into v_ref;
      return v_ref;
    exception when unique_violation then
      -- Çakışan şey numara mıydı, e-posta mı? E-posta ise yukarıdaki kontrol
      -- kaçırmış demektir (yarış durumu) — anlaşılır cümleye çeviriyoruz.
      if exists (
        select 1 from business_application
         where lower(btrim(email)) = v_eposta
           and status in ('PENDING','IN_REVIEW')
      ) then
        raise exception 'Bu e-posta ile değerlendirilmeyi bekleyen bir başvuru zaten var.'
          using errcode = 'MI409';
      end if;
      -- Numara çakıştı: döngü tekrar denesin.
    end;
  end loop;

  raise exception 'Başvuru numarası üretilemedi. Lütfen tekrar deneyin.'
    using errcode = 'MI500';
end $$;

comment on function app.basvuru_gonder is
  'Başvurunun TEK giriş kapısı. Doğrudan insert yetkisi yok. status, '
  'tenant_id ve karar alanları PARAMETRE OLARAK BİLE yok.';

-- ── Erişim ────────────────────────────────────────────────────────────────
-- ⚠️ Doğrudan insert yetkisi KALDIRILIYOR. 0032 bunu kolon listesiyle
-- daraltmıştı; artık hiç yok. Tek yol fonksiyon.
revoke insert on business_application from anon, authenticated;

drop policy if exists business_application_acik_basvuru on business_application;

revoke all on function app.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function app.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- Numara okunabilir olmalı (platform ekranı gösteriyor).
-- `authenticated` zaten SELECT alıyordu; kolon eklendi, yetki kolon bazlı
-- değil, dolayısıyla ek bir şey gerekmiyor.

-- ── Doğrulama ─────────────────────────────────────────────────────────────
do $$
declare
  v_ref   text;
  v_ref2  text;
  v_id    uuid;
  v_ayni_eposta_red boolean := false;
  v_dogrudan_red    boolean := false;
begin
  -- 1. Fonksiyon numara döndürüyor ve biçimi doğru
  v_ref := app.basvuru_gonder(
    '0033 Dogrulama Gida', 'Deneme Yetkili', '05321234500',
    'dogrulama-0033@example.com', '1234567890', 'Bornova',
    'İzmir', 'Bornova', 'Deneme adresi 1');
  if v_ref !~ '^MIY-[23456789ACDEFGHJKMNPQRTUVWXYZ]{5}$' then
    raise exception 'Numara biçimi beklenmedik: %', v_ref;
  end if;

  -- 2. Aynı e-postadan ikinci AÇIK başvuru reddediliyor
  begin
    perform app.basvuru_gonder(
      '0033 Ikinci Deneme', 'Deneme Yetkili', '05321234501',
      'DOGRULAMA-0033@example.com', '1234567890', 'Bornova',
      'İzmir', 'Bornova', 'Deneme adresi 2');
  exception when others then v_ayni_eposta_red := true;
  end;

  -- 3. Farklı e-posta geçiyor ve AYRI numara alıyor
  v_ref2 := app.basvuru_gonder(
    '0033 Ucuncu Deneme', 'Deneme Yetkili', '05321234502',
    'dogrulama-0033-b@example.com', '1234567890', 'Bornova',
    'İzmir', 'Bornova', 'Deneme adresi 3');
  if v_ref2 = v_ref then
    raise exception 'İki başvuru aynı numarayı aldı: %', v_ref;
  end if;

  raise notice 'numara: % · ikinci numara: % · ayni eposta red: %',
    v_ref, v_ref2, v_ayni_eposta_red;

  if not v_ayni_eposta_red then
    raise exception 'DOGRULAMA BASARISIZ: ayni e-postadan ikinci acik basvuru gecti.';
  end if;

  -- Doğrulama kayıtlarını reddedip bırakıyoruz (silinemezler: olay defteri
  -- değişmez, cascade tetikleyiciye çarpar).
  update business_application
     set status = 'REJECTED', decided_at = now(),
         decision_note = '0033 dogrulama kaydi'
   where reference in (v_ref, v_ref2);
end $$;

select 'numara kolonu' as ne,
       (select count(*)::text from business_application where reference is not null) as adet
union all
select 'numarasi olmayan (0 olmali)',
       (select count(*)::text from business_application where reference is null)
union all
select 'anon dogrudan insert (0 olmali)',
       (select count(*)::text from information_schema.role_table_grants
         where table_name = 'business_application'
           and privilege_type = 'INSERT' and grantee in ('anon','authenticated'))
union all
select 'dogrulama', 'gecti — numara uretiliyor, ayni e-postadan ikinci acik basvuru reddediliyor';
