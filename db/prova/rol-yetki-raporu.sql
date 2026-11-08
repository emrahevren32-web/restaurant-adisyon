-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · ROL VE YETKİ RAPORU · okur, hiçbir şey yazmaz
--
-- Kullanım (PostgreSQL 16 kurulu bir Linux'ta, göçler uygulanmışken):
--     su postgres -c "psql -q -d miyop -f db/prova/rol-yetki-raporu.sql"
--
-- ⚠️ NEDEN VAR: "kimde hangi yetki var" sorusunun cevabı ELLE YAZILMAZ.
-- Elle sürdürülen bir matris bir hafta içinde bayatlar ve bayat bir yetki
-- belgesi, olmayan bir güvenlik duygusu verir (tuzak 186).
-- `docs/kararlar/rol-yetki-matrisi.md` bu raporun çıktısından üretiliyor.
-- ═══════════════════════════════════════════════════════════════════════════

\echo '=== 1 · ROLLER ==='
select r.code as rol, r.name as ad, count(rp.permission_code) as izin_sayisi
  from role r left join role_permission rp on rp.role_code = r.code
 group by 1,2 order by 3 desc, 1;

\echo '=== 2 · IZIN KATALOGU · hangi izin hangi rollerde ==='
select p.module_code as modul, p.code as izin,
       coalesce(string_agg(rp.role_code, ', ' order by rp.role_code), '(hiç rol yok)') as roller
  from permission p left join role_permission rp on rp.permission_code = p.code
 group by 1,2 order by 1,2;

\echo '=== 3 · ROL BASINA IZINLER ==='
select rp.role_code as rol,
       string_agg(rp.permission_code, ', ' order by rp.permission_code) as izinler
  from role_permission rp group by 1 order by 1;

\echo '=== 4 · VERITABANI YAZMA KAPILARI (tablo basina) ==='
select c.relname as tablo,
       (regexp_match(pg_get_triggerdef(t.oid), 'izin_gerek_coklu\((.*)\)'))[1] as gerekli_izinler
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()')
 order by 1;

\echo '=== 5 · OKUMA KAPISI OLAN TABLOLAR (RLS politikasi izin soruyor) ==='
select tablename as tablo, cmd as komut, qual as kosul
  from pg_policies
 where schemaname = 'public' and qual like '%yetkim_var%'
 order by 1, 2;

\echo '=== 6 · YAZABILIP OKUYAMAYAN ROL VAR MI (0 olmali) ==='
select y.role_code as rol, 'numuneye yazabiliyor ama quality.read yok' as sorun
  from (select distinct role_code from role_permission
         where permission_code in ('quality.record.manage','quality.write')) y
 where not exists (select 1 from role_permission r
                    where r.role_code = y.role_code and r.permission_code = 'quality.read');
