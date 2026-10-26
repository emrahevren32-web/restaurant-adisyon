-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0097 — ŞAHİT NUMUNE İMHASI BİR ONAY İŞİDİR
--
-- ── EMRAH'IN KARARI (26.10.2026) ─────────────────────────────────────────
--   *"Müdür onaylar ama müdür yoksa gıda mühendisi veya kalitecide
--    onaylayabilir."*
--
-- 0093 numune defterini kurarken üç olayın (ALINDI, ACILDI, IMHA) hepsini
-- aynı kapıya bağlamıştı: `quality.record.manage` **veya**
-- `production.write`. Yani **üretim sorumlusu numuneyi imha edebiliyordu.**
-- Emrah'ın kararı bunu daraltıyor.
--
-- ── NEDEN DARALTMAK DOĞRU ────────────────────────────────────────────────
-- Numune almak ve açmak bir İŞTİR; imha etmek bir KARARDIR. Şahit numune
-- bir tartışmada işletmenin tek kanıtı; onu ortadan kaldırmak kanıtı
-- ortadan kaldırmak demek. Alan kişinin kendi aldığı numuneyi kendi başına
-- yok edebilmesi, defteri anlamsız kılar.
--
-- Bu, HACCP'te 0081'de verilen kararın aynısı: ölçümü GİRMEK geniş
-- (`quality.write`), ölçümü İPTAL ETMEK dar (`quality.record.manage`).
-- Aynı ayrım burada da geçerli.
--
-- ── KİM ONAYLAYABİLİYOR ──────────────────────────────────────────────────
-- `quality.record.manage` izni şu rollerde var (ölçüldü, tahmin değil —
-- `role_permission` tablosundan):
--   · isletme_muduru    ← Emrah'ın birinci tercihi
--   · gida_muhendisi    ← "müdür yoksa"
--   · kalite_sorumlusu  ← "müdür yoksa"
--   · isletme_sahibi    ← müdürün üstü
-- ⚠️ `uretim_sorumlusu` ve `depo_sorumlusu`da YOK — kararın istediği tam bu.
--
-- ⚠️ **"MÜDÜR YOKSA" KOŞULU SİSTEME YAZILMADI ve bu bilinçli.** Sistem
-- müdürün o gün işte olup olmadığını bilemez; bilmediği bir şeyi kural
-- gibi yazmak "mış gibi" yapmak olurdu. Üçü de onaylayabiliyor; sıralama
-- bir İŞLETME kuralı ve ekranda yazılı. Denetimde "kim onayladı" sorusunun
-- cevabı zaten kayıtta: imzayı sunucu atıyor (0093).
--
-- ⚠️ AYRI BİR "ONAYLAYAN" KOLONU AÇILMADI. İmha kaydını ancak onaylayabilen
-- biri yazabildiği için `actor_user_id` ZATEN onaylayandır. İkinci bir
-- kolon, doldurulmayan ya da ilkiyle çelişen bir alan olurdu.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- ALINDI ve ACILDI olayları eski kapıda: `quality.record.manage` VEYA
-- `production.write`. Üretim numuneyi almaya ve müşteri önünde açmaya
-- devam ediyor (İsmet: *"üretim her ürettiği partiden numune alıyor"*).
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · OLAY TİPİNE GÖRE KAPI ────────────────────────────────────────────
-- ⚠️ `app.izin_gerek_coklu()` tek bir izin listesi alıyor; olay tipine göre
-- ayrışamıyor. Bu yüzden numuneye kendi kapısı yazılıyor. Genel tetiği
-- "ya da şu kolon şu değerse" diye karmaşıklaştırmak, 30 tabloda kullanılan
-- bir fonksiyona tek tablonun kuralını sokmak olurdu.
create or replace function app.numune_olayi_izni()
returns trigger
language plpgsql set search_path = public, app
as $$
begin
  -- Göç, yedek geri yükleme ve `security definer` rutinlerimiz serbest
  -- (0089 deseni).
  if app.kapi_disi_baglam() then
    return new;
  end if;

  -- ── İMHA · DAR KAPI ────────────────────────────────────────────────────
  if new.event_type = 'IMHA' then
    if app.yetkim_var('quality.record.manage') then
      return new;
    end if;
    raise exception
      'MİYOP: şahit numune imhası bir ONAY işidir. İşletme müdürü onaylar; '
      'müdür yoksa gıda mühendisi ya da kalite sorumlusu onaylayabilir. '
      'Numuneyi siz alabilir ve açabilirsiniz, ama imhayı onlar yazar.'
      using errcode = 'MI403';
  end if;

  -- ── ALINDI ve ACILDI · ORTAK İŞ (0093) ────────────────────────────────
  if app.yetkim_var('quality.record.manage')
     or app.yetkim_var('production.write') then
    return new;
  end if;

  raise exception
    'MİYOP: şahit numune kaydı için su izinlerden biri gerekiyor: '
    'quality.record.manage, production.write. Hesabinizda yok.'
    using errcode = 'MI403';
end $$;

revoke all on function app.numune_olayi_izni() from public;
revoke all on function app.numune_olayi_izni() from anon;
revoke all on function app.numune_olayi_izni() from authenticated;

-- ⚠️ ESKİ TETİK DÜŞÜRÜLÜYOR. Bırakılırsa iki kapı birlikte çalışır ve
-- gevşek olan (0093'ün ikili izni) imhayı yine geçirir — iki kapıdan
-- geçmesi gereken bir istek, en gevşek kapının izniyle geçer.
drop trigger if exists izin_witness_sample_event on public.witness_sample_event;
drop trigger if exists izin_numune_olayi on public.witness_sample_event;
create trigger izin_numune_olayi
  before insert on public.witness_sample_event
  for each row execute function app.numune_olayi_izni();


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text; v_sayi int;
begin
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi_izni';
  if v_govde is null then
    raise exception '0097: app.numune_olayi_izni oluşmadı.';
  end if;
  if v_govde !~ 'new\.event_type = ''IMHA''' then
    raise exception '0097: kapı olay tipine göre ayrışmıyor.';
  end if;

  -- ⚠️ YENİ TETİK BAĞLI MI?
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample_event'
                    and g.tgname = 'izin_numune_olayi' and not g.tgisinternal) then
    raise exception '0097: izin_numune_olayi tetiği bağlı değil.';
  end if;

  -- ⚠️ ESKİ GEVŞEK TETİK GİTTİ Mİ? Kalırsa imha yine geçerdi.
  if exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
              where c.relname = 'witness_sample_event'
                and g.tgname = 'izin_witness_sample_event' and not g.tgisinternal) then
    raise exception '0097: eski gevşek izin tetiği hâlâ bağlı.';
  end if;

  -- ⚠️ NUMUNE TABLOSUNUN kapısı DEĞİŞMEDİ mi? Numune almak hâlâ ortak iş.
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'witness_sample'
                    and g.tgname = 'izin_witness_sample' and not g.tgisinternal) then
    raise exception '0097: numune tablosunun izin tetiği kaybolmuş.';
  end if;

  -- ⚠️ ONAYLAYABİLECEK ROL VAR MI? İzni hiçbir rolde olmayan bir kapı,
  -- imhayı tamamen kilitlerdi — kural değil kilit olurdu (tuzak 121).
  select count(*) into v_sayi from public.role_permission
   where permission_code = 'quality.record.manage';
  if v_sayi = 0 then
    raise exception
      '0097: quality.record.manage hiçbir rolde yok; imha tamamen kilitlendi.';
  end if;

  -- ⚠️ Emrah'ın saydığı üç rolün üçü de onaylayabiliyor mu?
  select count(*) into v_sayi from public.role_permission
   where permission_code = 'quality.record.manage'
     and role_code in ('isletme_muduru', 'gida_muhendisi', 'kalite_sorumlusu');
  if v_sayi <> 3 then
    raise exception
      '0097: müdür/gıda mühendisi/kalite sorumlusundan %si onaylayamıyor '
      '(quality.record.manage eksik).', 3 - v_sayi;
  end if;

  -- ⚠️ Üretim sorumlusu onaylayamıyor olmalı — kararın asıl amacı bu.
  if exists (select 1 from public.role_permission
              where permission_code = 'quality.record.manage'
                and role_code = 'uretim_sorumlusu') then
    raise exception
      '0097: üretim sorumlusu imhayı onaylayabiliyor; karar bunu dışlıyordu.';
  end if;

  raise notice '0097: Numune imhası onay izni (quality.record.manage) istiyor.';
end $$;
