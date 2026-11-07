-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0071c · GÖÇ YENİDEN ÇALIŞTIRILINCA KAPIYI ONARIYOR MU
--
-- ⚠️ BU DOSYA KIRIKTI VE SESSİZDİ (ölçüm 07.11.2026). İki ayrı kusuru vardı:
--   1. `\i /home/claude/is/prova/0071_...sql` — BAŞKA BİR MAKİNENİN mutlak
--      yolu. O klasör bu depoda yok; psql "No such file" diyordu. Dosya
--      `ON_ERROR_STOP off` ile başladığı için bu bir hata bile sayılmıyordu.
--   2. HİÇ DOĞRULAMA BASMIYORDU. Sessiz bir prova kanıt değildir: yeşil
--      görünür, hiçbir şey ölçmez.
--
-- ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
-- Kapı fonksiyonu DÜŞMÜŞ bir veritabanında göç yeniden çalıştırılırsa:
--   · `_ham` hesap gövdesine DOKUNULMAMALI (ad değişikliği atlanmalı),
--   · kapı yeniden kurulmalı, `plpgsql` ve `security INVOKER` olmalı,
--   · ve gerçekten kapatmalı: yetkisiz çağrı MI403 almalı.
--
-- ── ÖLÇÜLEMEYEN YARIM (dürüstçe yazılıyor) ───────────────────────────────
-- Göçün ikinci güvencesi: `_ham` DA yoksa göç sessizce devam etmez,
-- `0071: app.isletme_gostergeleri(uuid, date, date) yok` diye durur. Bu
-- tek bir işlemin içinde ölçülemiyor — hata işlemi düşürüyor ve ardından
-- hiçbir doğrulama koşturulamıyor. 07.11.2026'da ELLE ölçüldü: kapı ve
-- `_ham` birlikte düşürüldüğünde göç MI500 ile durdu, kapıyı boşluğun
-- üstüne KURMADI. Burada iddia edilmiyor; ölçümün yeri bu nottur.
--
-- ⚠️ `\ir` kullanılıyor, `\i` değil: `\ir` yolu BU DOSYANIN klasörüne göre
-- çözer. Mutlak yol yazmak, provayı yazıldığı makineye çivilemekti.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── Kapı düşürülüyor: hesap duruyor, kapı yok ────────────────────────────
drop function app.isletme_gostergeleri(uuid, date, date);

select prova_bak('sahne kuruldu: kapı yok, `_ham` hesap duruyor',
  to_regprocedure('app.isletme_gostergeleri(uuid, date, date)') is null
  and to_regprocedure('app.isletme_gostergeleri_ham(uuid, date, date)') is not null);

-- ── Göç yeniden çalıştırılıyor ───────────────────────────────────────────
\ir ../migrations/0071_analiz_yetkisi_sunucuda.sql

-- ── Onarım ölçülüyor ─────────────────────────────────────────────────────
select prova_bak('kapı yeniden kuruldu',
  to_regprocedure('app.isletme_gostergeleri(uuid, date, date)') is not null);

select prova_bak('`_ham` hesap gövdesi yerinde (ad değişikliği ATLANDI)',
  to_regprocedure('app.isletme_gostergeleri_ham(uuid, date, date)') is not null
  and to_regprocedure('app.kayip_ham(uuid, date, date)') is null);

select prova_bak('kapı plpgsql',
  (select l.lanname from pg_proc p join pg_language l on l.oid = p.prolang
    where p.oid = to_regprocedure('app.isletme_gostergeleri(uuid, date, date)'))
  = 'plpgsql');

select prova_bak('kapı security INVOKER (definer kiracı duvarını delerdi)',
  not (select p.prosecdef from pg_proc p
        where p.oid = to_regprocedure('app.isletme_gostergeleri(uuid, date, date)')));

-- ⚠️ YAPI YETMEZ, DAVRANIŞ DA ÖLÇÜLÜYOR. Doğru imzada ama içi boş bir
-- fonksiyon yukarıdaki dört kontrolü de geçerdi.
-- !! ÇAĞRI `authenticated` ROLÜ TAKILARAK YAPILIYOR (MIYOP-042). JWT'siz
-- süper kullanıcı olarak çağırmak kapının DIŞINDA koşmaktır; oradan
-- gelen cevap kapının çalıştığını GÖSTERMEZ. DDL (drop/create) süper
-- kullanıcıda kalıyor, ölçülen çağrı rolün içinde.
do $$
declare v_kod text := '';
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
  execute 'set local role authenticated';
  begin
    perform * from app.isletme_gostergeleri(null, current_date - 7, current_date);
  exception when others then v_kod := sqlstate;
  end;
  execute 'reset role';
  perform prova_bak('onarılan kapı GERÇEKTEN kapatıyor (gelen: '
    || coalesce(nullif(v_kod, ''), 'hata yok') || ')', v_kod = 'MI403');
end; $$;

rollback;
