-- ═══════════════════════════════════════════════════════════════════════════
-- TANI · "permission denied for table business_application_event" sürüyor mu?
--
-- Bu dosya bir GÖÇ DEĞİL. Hiçbir kalıcı değişiklik yapmaz: ikinci bölüm
-- açıkça `rollback` ile biter. Amaç, hatanın hâlâ var olup olmadığını
-- tahminle değil KANITLA söylemek.
--
-- Supabase SQL Editor'de TAMAMINI seçip çalıştırın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · 0037 gerçekten uygulandı mı? ─────────────────────────────────────
-- Beklenen: sahip_yetkisiyle = true
select
  p.proname                        as fonksiyon,
  p.prosecdef                      as sahip_yetkisiyle,
  pg_get_userbyid(p.proowner)      as fonksiyon_sahibi,
  pg_get_userbyid(c.relowner)      as tablo_sahibi
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join pg_class c
join pg_namespace cn on cn.oid = c.relnamespace
where n.nspname = 'app' and p.proname = 'basvuru_olayi_yaz'
  and cn.nspname = 'public' and c.relname = 'business_application_event';

-- ── 2 · Ekranın yaptığı işi, ekranın yetkisiyle dene ─────────────────────
-- Oturum taklit ediliyor (Emrah'ın Supabase Auth kimliği), rol
-- `authenticated`a düşürülüyor. Sonra geri alınıyor: hiçbir iz kalmaz.
begin;

select set_config(
  'request.jwt.claims',
  '{"sub":"141939e8-5779-43af-b468-9cbc8ee2b1fb","role":"authenticated"}',
  true) as oturum_taklidi;

set local role authenticated;

-- Bu satır 0037 çalıştıysa GEÇER, çalışmadıysa
-- "permission denied for table business_application_event" verir.
update business_application
   set status = 'IN_REVIEW'
 where reference = 'MIY-JQ28C';

select 'GUNCELLEME GECTI - 0037 calisiyor' as sonuc,
       (select count(*) from business_application_event e
          join business_application a on a.id = e.application_id
         where a.reference = 'MIY-JQ28C') as olay_adedi;

rollback;

-- ── 3 · Geriye hiçbir şey kalmadığını göster ─────────────────────────────
-- Beklenen: durum yine PENDING.
select reference as numara, status as durum from business_application
 where reference = 'MIY-JQ28C';
