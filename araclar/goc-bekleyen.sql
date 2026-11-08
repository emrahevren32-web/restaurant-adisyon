-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ: 0107 · 08.11.2026
--
-- ⚠️ SUPABASE SQL EDITOR'E BU DOSYANIN TAMAMINI YAPIŞTIR VE "Run" DE.
-- Canlı veritabanı 0106'da; bu göç şahit numunenin OKUMA kapısını
-- ekranla eşitliyor (MIYOP-100, Codex denetimi 07.11).
--
-- Tekrar çalıştırılabilir: iki kez koşturuldu, ikisinde de "gecti".
-- Prova veritabanında 56 provanın 56'sı yeşil.
--
-- ⚠️ ÇALIŞTIRDIKTAN SONRA bu dosya BOŞALTILIR (kontrol listesi 130):
-- `kaydet.ps1` her koşuda burayı panoya kopyalıyor; uygulanmış bir göç
-- kalırsa bir gün biri onu yeniden yapıştırır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0107 — ŞAHİT NUMUNE OKUMA KAPISI · MIYOP-100
--
-- ── NEDEN BU GÖÇ VAR ─────────────────────────────────────────────────────
-- Codex denetimi (07.11.2026) buldu, Claude gerçek PostgreSQL üzerinde
-- ÖLÇTÜ ve doğruladı:
--
--     witness_sample       → authenticated SELECT = t
--     witness_sample_event → authenticated SELECT = t
--     RLS politikası       → yalnız (tenant_id = app.current_tenant_id())
--
-- Yani okuma kapısı **kiracı duvarından ibaretti.** Menü ve rota
-- `quality.read` istiyor (business-workspace.registry.ts), veritabanı
-- istemiyordu. ÜÇ KAPI AYRIŞMIŞTI.
--
-- ⚠️ Sonucu şu: ekranı açamayan bir kullanıcı — aynı işletmede, oturumu
-- açık, deposunda çalışan biri — doğrudan API'ye istek atıp bütün şahit
-- numuneleri, açılış gerekçelerini ve sonuçlarını okuyabiliyordu.
-- "Ekranda gizlemek koruma değildir" kuralının ta kendisi (0092'nin
-- başlığında da yazılı).
--
-- ── NE DEĞİŞİYOR ─────────────────────────────────────────────────────────
-- Tek bir `for all` politikası vardı; komut başına politikalara ayrılıyor:
--
--   SELECT → kiracı VE app.yetkim_var('quality.read')
--   INSERT → kiracı            (yazma kapısı zaten TETİKTE)
--   UPDATE → kiracı
--   DELETE → kiracı
--
-- ⚠️ YAZMA KAPISINA DOKUNULMUYOR ve bu bilinçli. Yazma zaten iki ayrı
-- tetikle korunuyor:
--     izin_witness_sample → izin_gerek_coklu('quality.record.manage',
--                                            'production.write')
--     izin_numune_olayi   → app.numune_olayi_izni()
-- Aynı kuralı bir de RLS'e yazmak, iki yerde iki gerçek üretir ve bir gün
-- ayrışırlar (0036'nın dersi).
--
-- ⚠️ POLİTİKA EKLENMİYOR, DEĞİŞTİRİLİYOR. PostgreSQL izin veren
-- (permissive) politikaları **VEYA** ile birleştirir: mevcut `for all`
-- politikasının yanına ikinci bir SELECT politikası koymak kapıyı
-- DARALTMAZ, GENİŞLETİRDİ. Eski politika düşürülüyor.
--
-- ── ÖLÇÜLEN YAN ETKİ · `personel` ROLÜ ───────────────────────────────────
-- Ölçüm (prova veritabanı, 08.11): `production.write` taşıyıp
-- `quality.read` TAŞIMAYAN tek rol **`personel`**. Yani bu göçten sonra
-- `personel` numune yazabilir ama okuyamaz.
--
-- ⚠️ BU YENİ BİR TUTARSIZLIK DEĞİL, VAR OLANI GÖRÜNÜR KILIYOR: `personel`
-- bugün de ekranı AÇAMIYOR (menü ve rota `quality.read` istiyor). Yani
-- yazabildiği ama hiç göremediği bir defter zaten vardı. Doğru çözüm iki
-- yoldan biri ve bu bir ÜRÜN KARARI (Emrah'a soruldu, 08.11):
--     (a) `personel`e `quality.read` ver → görsün ve yazsın,
--     (b) yazma kapısından `production.write`ı çıkar → hiç karışmasın.
-- İkisi de bu göçün kapsamı DIŞINDA; burada yapılan yalnız okuma
-- kapısını ekranla eşitlemek.
--
-- ── RETURNING NOTU ───────────────────────────────────────────────────────
-- ⚠️ PostgreSQL'de `insert/update ... returning` SELECT politikasını DA
-- uygular. Yani `quality.read` olmayan bir yazar, `returning` isteyen bir
-- çağrıda satırı geri okuyamaz. Bu, `personel` için geçerli ve kabul
-- edilen sonuçtur: zaten göremeyeceği bir satırı geri okumamalı.
--
-- ── TETİKLER ETKİLENMİYOR ────────────────────────────────────────────────
-- `app.numune_turet()` ve `app.numune_olayi()` `security definer` ve
-- sahipleri `postgres`; süper kullanıcı RLS'i atlar, dolayısıyla olay
-- yazarken numuneyi bulmaya devam ederler. Prova bunu da sınıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── ÖN KOŞUL ──────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.witness_sample') is null then
    raise exception '0107: witness_sample yok — bu göç 0093''ten SONRA çalışmalı.'
      using errcode = 'MI500';
  end if;
  if not exists (select 1 from public.permission where code = 'quality.read') then
    raise exception '0107: `quality.read` izni katalogda yok.' using errcode = 'MI500';
  end if;
end $$;


-- ── 1 · witness_sample ────────────────────────────────────────────────────
drop policy if exists witness_sample_tenant_isolation on public.witness_sample;
drop policy if exists witness_sample_okuma            on public.witness_sample;
drop policy if exists witness_sample_ekleme           on public.witness_sample;
drop policy if exists witness_sample_guncelleme       on public.witness_sample;
drop policy if exists witness_sample_silme            on public.witness_sample;

create policy witness_sample_okuma on public.witness_sample
  for select using (
    tenant_id = app.current_tenant_id()
    and app.yetkim_var('quality.read')
  );

create policy witness_sample_ekleme on public.witness_sample
  for insert with check (tenant_id = app.current_tenant_id());

create policy witness_sample_guncelleme on public.witness_sample
  for update using      (tenant_id = app.current_tenant_id())
              with check (tenant_id = app.current_tenant_id());

create policy witness_sample_silme on public.witness_sample
  for delete using (tenant_id = app.current_tenant_id());


-- ── 2 · witness_sample_event ──────────────────────────────────────────────
drop policy if exists witness_sample_event_tenant_isolation on public.witness_sample_event;
drop policy if exists witness_sample_event_okuma            on public.witness_sample_event;
drop policy if exists witness_sample_event_ekleme           on public.witness_sample_event;
drop policy if exists witness_sample_event_guncelleme       on public.witness_sample_event;
drop policy if exists witness_sample_event_silme            on public.witness_sample_event;

create policy witness_sample_event_okuma on public.witness_sample_event
  for select using (
    tenant_id = app.current_tenant_id()
    and app.yetkim_var('quality.read')
  );

create policy witness_sample_event_ekleme on public.witness_sample_event
  for insert with check (tenant_id = app.current_tenant_id());

-- ⚠️ Defter append-only: güncelleme ve silme `numune_olayi_degismez`
-- tetiğiyle zaten reddediliyor. Politika YAZILMIYOR — politikasız komut
-- hiç satır görmez, yani ikinci bir kilit.


-- ── 3 · DOĞRULAMA ─────────────────────────────────────────────────────────
-- ⚠️ "Yazdım" demek yetmez; yazdığım şeyin çalıştığını GÖSTERMEM gerekiyor.
do $$
declare
  v_say int;
begin
  select count(*) into v_say from pg_policies
   where schemaname = 'public' and tablename = 'witness_sample';
  if v_say <> 4 then
    raise exception '0107 DOGRULAMA: witness_sample''da 4 politika bekleniyordu, % var.', v_say;
  end if;

  select count(*) into v_say from pg_policies
   where schemaname = 'public' and tablename = 'witness_sample_event';
  if v_say <> 2 then
    raise exception '0107 DOGRULAMA: witness_sample_event''te 2 politika bekleniyordu, % var.', v_say;
  end if;

  -- Okuma politikaları GERÇEKTEN izni soruyor mu
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'witness_sample'
       and cmd = 'SELECT' and qual like '%quality.read%')
  then
    raise exception '0107 DOGRULAMA: witness_sample okuma politikasi izni sormuyor.';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'witness_sample_event'
       and cmd = 'SELECT' and qual like '%quality.read%')
  then
    raise exception '0107 DOGRULAMA: witness_sample_event okuma politikasi izni sormuyor.';
  end if;

  -- ⚠️ Eski `for all` politikası GERÇEKTEN düşmüş olmalı: dururken
  -- yanına politika eklemek kapıyı daraltmaz, genişletirdi.
  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename in ('witness_sample','witness_sample_event')
       and cmd = 'ALL')
  then
    raise exception '0107 DOGRULAMA: eski `for all` politikasi duruyor.';
  end if;

  -- Yazma kapısının tetikleri yerinde mi (bu göç onlara dokunmadı)
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.witness_sample'::regclass
       and tgname = 'izin_witness_sample' and not tgisinternal)
  then
    raise exception '0107 DOGRULAMA: yazma kapisi tetigi kaybolmus.';
  end if;

  raise notice '0107 TAMAM · sahit numune okumasi artik `quality.read` istiyor.';
end $$;


-- ── 4 · ÖZET ──────────────────────────────────────────────────────────────
select 'witness_sample politika sayisi' as ne,
       (select count(*)::text from pg_policies
         where schemaname='public' and tablename='witness_sample') as deger
union all
select 'witness_sample_event politika sayisi',
       (select count(*)::text from pg_policies
         where schemaname='public' and tablename='witness_sample_event')
union all
select 'okuma politikalari izin soruyor',
       (select count(*)::text from pg_policies
         where schemaname='public'
           and tablename in ('witness_sample','witness_sample_event')
           and cmd='SELECT' and qual like '%quality.read%')
union all
select 'eski for all politikasi (0 olmali)',
       (select count(*)::text from pg_policies
         where schemaname='public'
           and tablename in ('witness_sample','witness_sample_event')
           and cmd='ALL')
union all
select 'dogrulama', 'gecti';
