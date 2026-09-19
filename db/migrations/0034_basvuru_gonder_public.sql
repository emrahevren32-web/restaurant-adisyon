-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4D / KAPI
-- 0034 — `basvuru_gonder` dışarı açılıyor: app → public
--
-- ⚠️ AYNI HATA İKİNCİ KEZ. 0016 tam bu yüzden yazılmış:
--
--   "Supabase'in REST katmanı (PostgREST) YALNIZCA `public` şemasındaki
--    fonksiyonları yayınlar." — 0016 başlığı
--
--   0012 politika RPC'sini `app`'e koymuş, tarayıcıdan çağrılamamış; 0016
--   onu `public`'e taşıyarak düzeltmiş. Ben 0033'te `app.basvuru_gonder`
--   yazdım ve aynı duvara çarptım. Form canlıda şunu verdi:
--
--     "Could not find the function public.basvuru_gonder(...) in the
--      schema cache"
--
--   Depoda yazılı bir dersi tekrar öğrenmek, öğrenmemekten pahalıdır.
--   Bu yüzden düzeltmenin yanına bir TEST koyuyorum:
--   `src/onboarding/rpc.arch.test.ts` — koddan `.rpc('ad')` ile çağrılan
--   her fonksiyonun göçlerde `public` şemasında yaratıldığını doğruluyor.
--   Bu hata bir daha canlıya ulaşamaz.
--
-- ── KALIP (0016 ile aynı) ────────────────────────────────────────────────
-- Gövde `app`'te KALIYOR (SQL Editor'den çağıranlar kırılmasın), `public`
-- ince bir kabuk olarak onu çağırıyor. Gövde iki yere kopyalanmıyor —
-- kopyalanan kural ayrışır.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.basvuru_gonder(
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
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  return app.basvuru_gonder(
    p_company_name, p_owner_name, p_phone, p_email, p_tax_number,
    p_tax_office, p_city, p_district, p_address, p_sector_code, p_note);
end $$;

comment on function public.basvuru_gonder is
  'Başvurunun dışarıya açık kapısı. Gövde app.basvuru_gonder içinde (0033). '
  'PostgREST yalnız public şemasını yayınlar — bkz. 0016.';

-- ── Erişim ────────────────────────────────────────────────────────────────
revoke all on function public.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text)
  to anon, authenticated;

-- `app` sürümünü dışarıya kapatıyoruz: tek kapı `public` olsun. SQL
-- Editor (owner) yine çağırabilir.
revoke all on function app.basvuru_gonder(
  text, text, text, text, text, text, text, text, text, text, text)
  from anon, authenticated;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
do $$
declare
  v_ref text;
begin
  -- public sürümü gerçekten çalışıyor mu (kabuk doğru delege ediyor mu)
  v_ref := public.basvuru_gonder(
    '0034 Dogrulama Gida', 'Deneme Yetkili', '05321234600',
    'dogrulama-0034@example.com', '1234567890', 'Bornova',
    'İzmir', 'Bornova', 'Deneme adresi 1');

  if v_ref !~ '^MIY-[23456789ACDEFGHJKMNPQRTUVWXYZ]{5}$' then
    raise exception 'public.basvuru_gonder beklenen numarayı vermedi: %', v_ref;
  end if;

  raise notice 'public.basvuru_gonder calisiyor · numara: %', v_ref;

  update business_application
     set status = 'REJECTED', decided_at = now(),
         decision_note = '0034 dogrulama kaydi'
   where reference = v_ref;
end $$;

select 'public fonksiyonu' as ne,
       count(*)::text as adet
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'basvuru_gonder'
union all
select 'anon cagirabiliyor',
       case when has_function_privilege('anon',
         'public.basvuru_gonder(text,text,text,text,text,text,text,text,text,text,text)',
         'EXECUTE') then 'evet' else 'HAYIR' end
union all
select 'dogrulama', 'gecti — public kabuk calisiyor ve numara donuyor';
