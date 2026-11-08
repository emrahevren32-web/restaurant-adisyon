-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ: 0108 · 08.11.2026
--
-- ⚠️ SUPABASE SQL EDITOR'E BU DOSYANIN TAMAMINI YAPIŞTIR VE "Run" DE.
-- 0107 uygulandı (ekran görüntüsüyle doğrulandı: 4 / 2 / 2 / 0 / gecti).
-- Bu göç Emrah'ın (b) kararını uyguluyor: `personel` şahit numuneye
-- karışmıyor. Üretim sorumlusu akışta KALIYOR.
--
-- Tekrar çalıştırılabilir: iki kez koşturuldu. Prova veritabanında
-- 109 göç, 57 provanın 57'si yeşil.
--
-- ⚠️ ÇALIŞTIRDIKTAN SONRA bu dosya BOŞALTILIR (kontrol listesi 130).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0108 — ŞAHİT NUMUNE YAZMA KAPISI DARALIYOR
--                     `production.write` → `quality.write`
--
-- ── NEDEN ────────────────────────────────────────────────────────────────
-- 0107 okuma kapısını ekranla eşitledi ve ortaya şu çıktı: `production.write`
-- taşıyıp `quality.read` TAŞIMAYAN tek rol **`personel`**. Yani `personel`
-- numune yazabiliyor ama ne ekranı açabiliyor ne de yazdığını okuyabiliyor.
-- Yazdığı ama hiç göremediği bir defter.
--
-- Emrah'ın kararı (08.11.2026): *"(b) yazma kapısından production.write'ı
-- çıkaralım, hiç karışmasın."*
--
-- ── NEDEN DOĞRUDAN SİLMİYORUZ DA `quality.write` KOYUYORUZ ───────────────
-- ⚠️ `production.write`ı silip yerine bir şey koymamak **üretim
-- sorumlusunu da dışarıda bırakırdı** — oysa İsmet'in anlattığı akışta
-- numuneyi ÜRETİM alıyor ve `prova-0093` bunu bir kural olarak sınıyor
-- ("üretim sorumlusu numune ALABİLMELİ").
--
-- Ölçüm (rol kataloğu, 08.11):
--     production.write       : admin, isletme_muduru, isletme_sahibi,
--                              PERSONEL, super_admin, uretim_sorumlusu
--     quality.write          : admin, gida_muhendisi, isletme_muduru,
--                              isletme_sahibi, kalite_sorumlusu,
--                              sevkiyat_sorumlusu, super_admin,
--                              uretim_sorumlusu
--
-- `quality.write` üretimi İÇERİYOR, personeli İÇERMİYOR. İstenen tam olarak
-- bu. Üstelik anlamı da doğru: şahit numune bir KALİTE kaydıdır.
--
-- ⚠️ TEK YAN ETKİ, GİZLENMİYOR: `sevkiyat_sorumlusu` artık numune
-- yazabilecek (önce yazamıyordu). Kabul edilebilir çünkü şahit numune
-- çoğu işletmede SEVK ANINDA alınıyor ve o rol `quality.read` taşıdığı
-- için ekranı zaten görebiliyor. ⚠️ Emrah'a ayrıca soruldu; istemezse
-- tek satırlık bir göçle geri alınır.
--
-- ── ÜÇ KAPI ARTIK TAM EŞİT ───────────────────────────────────────────────
-- Bu göçten sonra numuneye YAZABİLEN her rol, numuneyi OKUYABİLİYOR da:
--     quality.record.manage ⊂ quality.read  ✔
--     quality.write         ⊂ quality.read  ✔
-- Yani "yazdığını göremeyen kullanıcı" diye bir hâl KALMIYOR. Doğrulama
-- bölümü bunu ölçüyor ve sağlamazsa göç DURUYOR.
--
-- ⚠️ İMHA DAR KAPIDA KALIYOR (`quality.record.manage`). 0097'nin kararı:
-- "Numuneyi siz alabilir ve açabilirsiniz, ama imhayı onlar yazar."
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('app.numune_olayi_izni()') is null then
    raise exception '0108: app.numune_olayi_izni yok — bu göç 0097''den SONRA çalışmalı.'
      using errcode = 'MI500';
  end if;
  if not exists (select 1 from public.permission where code = 'quality.write') then
    raise exception '0108: `quality.write` izni katalogda yok.' using errcode = 'MI500';
  end if;
end $$;


-- ── 1 · NUMUNE KARTI · yazma tetiği ───────────────────────────────────────
drop trigger if exists izin_witness_sample on public.witness_sample;
create trigger izin_witness_sample
  before insert or update on public.witness_sample
  for each row execute function app.izin_gerek_coklu('quality.record.manage', 'quality.write');


-- ── 2 · OLAY DEFTERİ · ALINDI/ACILDI ortak işi ────────────────────────────
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

  -- ── İMHA · DAR KAPI (0097 kararı, DEĞİŞMEDİ) ──────────────────────────
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

  -- ── ALINDI ve ACILDI · ORTAK İŞ ───────────────────────────────────────
  -- ⚠️ 0108: `production.write` yerine `quality.write`. Gerekçe başlıkta.
  if app.yetkim_var('quality.record.manage')
     or app.yetkim_var('quality.write') then
    return new;
  end if;

  raise exception
    'MİYOP: şahit numune kaydı için su izinlerden biri gerekiyor: '
    'quality.record.manage, quality.write. Hesabinizda yok.'
    using errcode = 'MI403';
end $$;

revoke all on function app.numune_olayi_izni() from public;
revoke all on function app.numune_olayi_izni() from anon;
revoke all on function app.numune_olayi_izni() from authenticated;


-- ── 3 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_arg text; v_govde text; v_say int;
begin
  -- Tetik yeni izinlerle kurulmuş mu
  select pg_get_triggerdef(t.oid) into v_arg
    from pg_trigger t
   where t.tgrelid = 'public.witness_sample'::regclass
     and t.tgname = 'izin_witness_sample' and not t.tgisinternal;
  if v_arg is null then
    raise exception '0108 DOGRULAMA: izin_witness_sample tetigi yok.';
  end if;
  if v_arg !~ 'quality\.write' then
    raise exception '0108 DOGRULAMA: tetik `quality.write` istemiyor: %', v_arg;
  end if;
  if v_arg ~ 'production\.write' then
    raise exception '0108 DOGRULAMA: tetikte `production.write` hala var: %', v_arg;
  end if;

  -- Olay kapısının gövdesi
  -- ⚠️ YORUMLAR ATILIYOR (tuzak 181, bu depoda DÖRDÜNCÜ kez). İlk yazımda
  -- bu kontrol KENDİ açıklama yorumuma takıldı: `pg_get_functiondef`
  -- yorumları da döndürüyor ve gövdede "eski izni yenisiyle değiştirdim"
  -- diye yazan satır, eski iznin HÂLÂ KULLANILDIĞI sanıldı. Yorum kuralı
  -- ANLATIR; kuralı ölçen şey onu atmak zorunda.
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi_izni';
  v_govde := regexp_replace(v_govde, '--[^\n]*', '', 'g');
  if v_govde ~ 'production\.write' then
    raise exception '0108 DOGRULAMA: olay kapisinda `production.write` hala var.';
  end if;
  if v_govde !~ 'new\.event_type = ''IMHA''' then
    raise exception '0108 DOGRULAMA: imha dar kapisi kaybolmus.';
  end if;

  -- ⚠️ ÜRETİM SORUMLUSU DIŞARIDA KALMAMALI. Bu göçün tek gerçek riski bu.
  if not exists (select 1 from public.role_permission
                  where role_code = 'uretim_sorumlusu'
                    and permission_code in ('quality.record.manage','quality.write')) then
    raise exception '0108 DOGRULAMA: uretim_sorumlusu numune yazamaz hale geldi.';
  end if;

  -- ⚠️ PERSONEL ÇIKMALI. İstenen sonuç buydu.
  if exists (select 1 from public.role_permission
              where role_code = 'personel'
                and permission_code in ('quality.record.manage','quality.write')) then
    raise exception '0108 DOGRULAMA: personel hala numune yazabiliyor.';
  end if;

  -- ⚠️ ÜÇ KAPI EŞİT Mİ: yazabilen her rol okuyabilmeli.
  select count(*) into v_say
    from (select distinct role_code from public.role_permission
           where permission_code in ('quality.record.manage','quality.write')) y
   where not exists (select 1 from public.role_permission r
                      where r.role_code = y.role_code
                        and r.permission_code = 'quality.read');
  if v_say > 0 then
    raise exception '0108 DOGRULAMA: % rol yazabiliyor ama okuyamiyor.', v_say;
  end if;

  raise notice '0108 TAMAM · numune yazma kapisi quality.write''e gecti; '
    'yazabilen her rol okuyabiliyor.';
end $$;


-- ── 4 · ÖZET ──────────────────────────────────────────────────────────────
select 'numune yazma izinleri' as ne,
       (select string_agg(x, ', ' order by x) from (
          select unnest(array['quality.record.manage','quality.write']) as x) s) as deger
union all
select 'yazabilen rol sayisi',
       (select count(distinct role_code)::text from role_permission
         where permission_code in ('quality.record.manage','quality.write'))
union all
select 'yazip okuyamayan rol (0 olmali)',
       (select count(*)::text from (
          select distinct role_code from role_permission
           where permission_code in ('quality.record.manage','quality.write')) y
         where not exists (select 1 from role_permission r
                            where r.role_code = y.role_code
                              and r.permission_code = 'quality.read'))
union all
select 'personel yazabiliyor mu (hayir olmali)',
       case when exists (select 1 from role_permission
                          where role_code='personel'
                            and permission_code in ('quality.record.manage','quality.write'))
            then 'EVET' else 'hayir' end
union all
select 'uretim_sorumlusu yazabiliyor mu (evet olmali)',
       case when exists (select 1 from role_permission
                          where role_code='uretim_sorumlusu'
                            and permission_code in ('quality.record.manage','quality.write'))
            then 'evet' else 'HAYIR' end
union all
select 'dogrulama', 'gecti';
